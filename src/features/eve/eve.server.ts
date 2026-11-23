// Server-only: the bridge between the admin's browser, the Eve service and the app. Three rules hold here:
// every call acts as a real admin (requireAdmin), the model can only *propose* a change, and only that admin's own
// signed-in request can run it.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Ctx } from "@/server/context.server";
import type { DB } from "@/server/db";
import { AccessError, requireAdmin, type Actor } from "@/server/guard";
import { checkSize, HttpError, publicError, rateLimit, respond } from "@/server/request";
import { isObject } from "@/server/validate";
import { EVE_OPERATIONS, type EveOperation } from "./catalog.server";

const ISSUER = "twc-app";
export const SESSION_AUDIENCE = "twc-eve";
export const TOOL_AUDIENCE = "twc-eve-tools";
const TOKEN_SECONDS = 300;
const PROPOSAL_MS = 15 * 60_000;
const MAX_MESSAGE_BYTES = 16_384;
const MAX_TOOL_BYTES = 40_000;
const MAX_INPUT = 32_000;
const MAX_RESULT = 60_000;
const PAGE = 25;
const MAX_PAGE = 50;

const messages = rateLimit(40, 10 * 60_000);
const toolCalls = rateLimit(240, 10 * 60_000);

/** The shared secret, or null while Eve isn't set up (the assistant then says so and nothing else changes). */
export function eveSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.EVE_SHARED_SECRET ?? "";
  return secret.length >= 32 ? secret : null;
}
const eveUrl = (env: Record<string, string | undefined> = process.env) => (env.EVE_URL || "http://127.0.0.1:8790").replace(/\/+$/, "");

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const mac = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest();

export function signEveToken(sub: string, aud: string, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const body = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify({ iss: ISSUER, aud, sub, iat, exp: iat + TOKEN_SECONDS }))}`;
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

/** The token's subject, or null for anything forged, expired, or meant for another audience. */
export function verifyEveToken(token: string, aud: string, secret: string, now = Date.now()): string | null {
  const [header, payload, signature, extra] = token.split(".");
  if (!header || !payload || !signature || extra !== undefined) return null;
  const expected = mac(`${header}.${payload}`, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString()) as { alg?: unknown };
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { iss?: unknown; aud?: unknown; sub?: unknown; exp?: unknown };
    if (head.alg !== "HS256" || claims.iss !== ISSUER || claims.aud !== aud) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= now || typeof claims.sub !== "string" || !claims.sub) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

const SECRET_KEY = /token|secret|password|hash|cookie/i;

/** Drops credential-like fields at any depth, so they never reach the model. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEY.test(key)).map(([key, v]) => [key, redact(v)]));
}

function page(items: unknown[], query: string, offset: number, limit: number) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? items.filter((item) => { const text = JSON.stringify(item).toLowerCase(); return terms.every((t) => text.includes(t)); }) : items;
  return { total: hits.length, offset, items: hits.slice(offset, offset + limit) };
}

/** A read's answer for the model: no credentials, one page of each list, and a bounded size. */
export function shapeRead(result: unknown, options: { query?: unknown; offset?: unknown; limit?: unknown } = {}): unknown {
  const query = typeof options.query === "string" ? options.query.slice(0, 120) : "";
  const offset = Number.isInteger(options.offset) && (options.offset as number) > 0 ? (options.offset as number) : 0;
  const limit = Number.isInteger(options.limit) ? Math.min(Math.max(options.limit as number, 1), MAX_PAGE) : PAGE;
  const clean = redact(result);
  const shaped = Array.isArray(clean)
    ? page(clean, query, offset, limit)
    : isObject(clean)
      ? Object.fromEntries(Object.entries(clean).map(([key, v]) => [key, Array.isArray(v) ? page(v, query, offset, limit) : v]))
      : clean;
  const text = JSON.stringify(shaped ?? null);
  if (text.length > MAX_RESULT) return { tooLarge: true, message: "That result is too large. Search with a query or ask for a smaller limit." };
  return shaped ?? null;
}

const operation = (name: unknown, kind: EveOperation["kind"]): EveOperation => {
  const op = typeof name === "string" && Object.hasOwn(EVE_OPERATIONS, name) ? EVE_OPERATIONS[name] : undefined;
  if (!op || op.kind !== kind) throw new AccessError(`Unknown ${kind} operation.`, 400);
  return op;
};

export const eveCatalog = () => Object.entries(EVE_OPERATIONS).map(([name, { kind, area, label, input, notifies, destructive }]) =>
  ({ name, kind, area, label, input, ...(notifies ? { notifies } : {}), ...(destructive ? { destructive } : {}) }));

export function propose({ db, actor }: Ctx, name: unknown, input: unknown, now = Date.now()): { proposalId: string; status: "waiting_for_admin" } {
  const me = requireAdmin(db, actor);
  operation(name, "write");
  const text = JSON.stringify(input ?? {});
  if (text.length > MAX_INPUT) throw new AccessError("That change is too large.", 400);
  const id = randomUUID();
  db.prepare("insert into eve_proposals (id, actor_id, operation, input, expires_at) values (?, ?, ?, ?, ?)")
    .run(id, me.id, name as string, text, new Date(now + PROPOSAL_MS).toISOString());
  return { proposalId: id, status: "waiting_for_admin" };
}

type ProposalRow = { id: string; operation: string; input: string; expires_at: string };

/** Who a change is about, read from the database rather than from anything the model wrote. */
function subjectOf(db: DB, input: Record<string, unknown>): string | null {
  for (const key of ["id", "member_id", "memberId", "applicationId"]) {
    const id = input[key];
    if (typeof id !== "string") continue;
    const row = (db.prepare("select full_name as name from profiles where id = ?").get(id)
      ?? db.prepare("select full_name || ' <' || email || '>' as name from applications where id = ?").get(id)) as { name: string } | undefined;
    if (row?.name) return row.name;
  }
  return null;
}

const displayValue = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
};

/** This admin's waiting changes, described from the stored operation and input (never the model's own summary). */
export function listProposals({ db, actor }: Ctx, now = Date.now()) {
  const me = requireAdmin(db, actor);
  const iso = new Date(now).toISOString();
  db.prepare("update eve_proposals set status = 'expired', input = '{}', decided_at = ? where actor_id = ? and status = 'pending' and expires_at <= ?").run(iso, me.id, iso);
  const rows = db.prepare("select id, operation, input, expires_at from eve_proposals where actor_id = ? and status = 'pending' order by created_at").all(me.id) as ProposalRow[];
  return rows.flatMap((row) => {
    const op = Object.hasOwn(EVE_OPERATIONS, row.operation) ? EVE_OPERATIONS[row.operation] : undefined;
    if (!op) return [];
    const input = JSON.parse(row.input) as unknown;
    const fields = isObject(input) ? Object.entries(input).filter(([, v]) => v !== undefined).map(([key, v]) => ({ key, value: displayValue(v) })) : [];
    return [{
      id: row.id, label: op.label, area: op.area, notifies: !!op.notifies, destructive: !!op.destructive,
      subject: isObject(input) ? subjectOf(db, input) : null, fields, expiresAt: row.expires_at,
    }];
  });
}

/** Runs or cancels one waiting change. Claiming the row first means a double click can't run it twice. */
export async function decideProposal(c: Ctx, id: unknown, decision: unknown, now = Date.now()): Promise<{ ok: boolean; label: string; error?: string; result?: unknown }> {
  const me = requireAdmin(c.db, c.actor);
  if (typeof id !== "string" || id.length > 64) throw new AccessError("That request wasn’t found.", 404);
  if (decision !== "confirm" && decision !== "cancel") throw new AccessError("Choose confirm or cancel.", 400);
  const iso = new Date(now).toISOString();
  const row = c.db.prepare("select id, operation, input, expires_at from eve_proposals where id = ? and actor_id = ?").get(id, me.id) as ProposalRow | undefined;
  if (!row) throw new AccessError("That request wasn’t found.", 404);
  const op = Object.hasOwn(EVE_OPERATIONS, row.operation) ? EVE_OPERATIONS[row.operation] : undefined;
  if (!op || op.kind !== "write") throw new AccessError("That request wasn’t found.", 404);
  const next = decision === "confirm" ? "running" : "cancelled";
  const clearInput = decision === "cancel" ? ", input = '{}'" : "";
  const claimed = c.db.prepare(`update eve_proposals set status = ?, decided_at = ?${clearInput} where id = ? and actor_id = ? and status = 'pending' and expires_at > ?`)
    .run(next, iso, id, me.id, iso);
  if (!claimed.changes) throw new AccessError("That request expired or was already handled.", 409);
  if (decision === "cancel") return { ok: false, label: op.label };
  try {
    const result = await op.run(c, JSON.parse(row.input));
    c.db.prepare("update eve_proposals set status = 'done', input = '{}' where id = ?").run(id);
    return { ok: true, label: op.label, ...(op.revealResult ? { result } : {}) };
  } catch (error) {
    const message = publicError(error).message.slice(0, 300);
    c.db.prepare("update eve_proposals set status = 'failed', input = '{}', error = ? where id = ?").run(message, id);
    return { ok: false, label: op.label, error: message };
  }
}

/** The Eve service calling back. Its signed token names the admin; that admin is checked again on every call. */
export async function toolRequest(db: DB, request: Request): Promise<Response> {
  return respond(async () => {
    const secret = eveSecret();
    if (!secret) throw new HttpError("Eve isn’t set up.", 503);
    const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
    const sub = verifyEveToken(bearer, TOOL_AUDIENCE, secret);
    const user = sub ? db.prepare(`select id, email from "user" where id = ?`).get(sub) as { id: string; email: string } | undefined : undefined;
    if (!user) throw new AccessError("Please sign in.", 401);
    const actor: Actor = { id: user.id, email: user.email };
    const c: Ctx = { db, actor };
    requireAdmin(db, actor);
    if (!toolCalls(user.id)) throw new HttpError("Eve is doing too much at once. Try again shortly.", 429);
    checkSize(request, MAX_TOOL_BYTES);
    const body = await request.json().catch(() => null) as unknown;
    if (!isObject(body)) throw new AccessError("Invalid request.", 400);
    if (body.action === "catalog") return { operations: eveCatalog() };
    if (body.action === "read") return { data: shapeRead(await operation(body.operation, "read").run(c, body.input ?? {}), body) };
    if (body.action === "propose") return propose(c, body.operation, body.input);
    throw new AccessError("Invalid request.", 400);
  });
}

const SESSION_PATH = /^v1\/session(?:\/([\w-]{1,128})(?:\/(stream|cancel))?)?$/;

/** The admin's browser to the Eve service: admin-only, one conversation per owner, and only the chat routes. */
export async function proxyEve(c: Ctx, request: Request, path: string): Promise<Response> {
  try {
    const me = requireAdmin(c.db, c.actor);
    const secret = eveSecret();
    if (!secret) return Response.json({ error: "Eve isn’t set up yet." }, { status: 503 });
    const match = SESSION_PATH.exec(path);
    if (!match) throw new AccessError("Not found.", 404);
    const [, sessionId, action] = match;
    const method = request.method;
    if (method !== (action === "stream" ? "GET" : "POST")) throw new AccessError("Not found.", 404);
    if (sessionId) {
      const owner = c.db.prepare("select actor_id from eve_sessions where session_id = ?").get(sessionId) as { actor_id: string } | undefined;
      if (owner?.actor_id !== me.id) throw new AccessError("Not found.", 404);
    }
    let body: string | undefined;
    if (method === "POST") {
      checkSize(request, MAX_MESSAGE_BYTES);
      if (!action && !messages(me.id)) throw new HttpError("That’s a lot of messages. Try again in a few minutes.", 429);
      body = await request.text();
    }
    const search = new URL(request.url).search;
    const upstream = await fetch(`${eveUrl()}/eve/${path}${action === "stream" ? search : ""}`, {
      method, body, signal: request.signal,
      headers: { authorization: `Bearer ${signEveToken(me.id, SESSION_AUDIENCE, secret)}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    }).catch(() => null);
    if (!upstream) return Response.json({ error: "Eve isn’t answering right now." }, { status: 502 });
    const started = upstream.headers.get("x-eve-session-id")?.trim();
    let text: string | null = null;
    let created = started;
    if (!sessionId && upstream.ok) {
      text = await upstream.text();
      try { created = (JSON.parse(text) as { sessionId?: string }).sessionId ?? started; } catch { /* the header above still names it */ }
      if (created && /^[\w-]{1,128}$/.test(created)) c.db.prepare("insert or ignore into eve_sessions (session_id, actor_id) values (?, ?)").run(created, me.id);
    }
    const headers = new Headers({ "cache-control": "no-store, no-transform" });
    for (const name of ["content-type", "x-eve-session-id"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(text ?? upstream.body, { status: upstream.status, headers });
  } catch (error) {
    const safe = publicError(error);
    const status = safe instanceof AccessError || safe instanceof HttpError ? safe.status : 500;
    return Response.json({ error: safe.message }, { status });
  }
}
