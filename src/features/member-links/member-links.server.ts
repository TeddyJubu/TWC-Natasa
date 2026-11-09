// Server-only: personal member review links (migration 0003). Admins mint, list and revoke (requireAdmin); the
// token holder — no session needed, the link is the credential — reads her own prefill and sends one review.
// Only the token's SHA-256 is stored and the URL is returned once, to the minting admin (FIX-IN-REBUILD CRM-171).
// Bad, used, expired, revoked and not-a-member tokens all look the same (OPS-027), so links can't be probed.
import { createHash, randomBytes } from "node:crypto";
import type { Ctx } from "@/server/context.server";
import { now, tx, type DB } from "@/server/db";
import { appUrl } from "@/server/email";
import { AccessError, isMember, requireAdmin } from "@/server/guard";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";
import { bad, isObject, str, type Json } from "@/server/validate";
import { checkReview, FORM_VERSION, INFO_FIELDS, type InfoField } from "./schema";

/** The old intake's LINK_TTL_DAYS default. */
export const LINK_TTL_DAYS = 30;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
/** The one answer for every token that doesn't open the form. */
export const INVALID_LINK = "This link isn’t valid: it may have expired or already been used. Reply to your invitation email and we’ll send a fresh one.";
const invalidLink = () => new HttpError(INVALID_LINK, 404);

export type LinkState = { state: "active" | "used" | "expired"; created_at: string; expires_at: string; used_at: string | null };
export type MintedLink = { url: string; expires_at: string };
export type ReviewPrefill = { firstName: string; values: Record<InfoField, string> };
export type AdminReview = { id: string; member_id: string; full_name: string; answers: { [key: string]: Json }; created_at: string };

const memberIdOf = (input: unknown) => {
  if (!isObject(input)) throw bad("member");
  return str(input.member_id, "member", 64);
};

// ---------- Admin ----------

/**
 * A new review link for an approved member, valid LINK_TTL_DAYS. Any live review link she has is retired first
 * (one live link per kind, CRM-084). The raw token exists only in the returned URL.
 */
export function mintReviewLink({ db, actor }: Ctx, input: unknown): MintedLink {
  const me = requireAdmin(db, actor);
  const memberId = memberIdOf(input);
  if (!isMember(db, memberId)) throw new AccessError("Personal links are for approved members.", 400);
  const token = randomBytes(32).toString("base64url");
  const at = now();
  const expires_at = new Date(Date.now() + LINK_TTL_DAYS * 86_400_000).toISOString();
  tx(db, () => {
    retire(db, memberId, at);
    db.prepare("insert into member_links (member_id, purpose, token_hash, created_by, created_at, expires_at) values (?, 'review', ?, ?, ?, ?)")
      .run(memberId, hashToken(token), me.id, at, expires_at);
  });
  return { url: `${appUrl()}/review?t=${token}`, expires_at };
}

/** Ends her live review link now (CRM-086); returns how many were live (0 or 1). */
export function revokeReviewLink({ db, actor }: Ctx, input: unknown): number {
  requireAdmin(db, actor);
  return retire(db, memberIdOf(input), now());
}

const retire = (db: DB, memberId: string, at: string) => Number(
  db.prepare("update member_links set expires_at = ? where member_id = ? and purpose = 'review' and used_at is null and expires_at > ?")
    .run(at, memberId, at).changes,
);

export const linkState = (row: Omit<LinkState, "state">, at = now()): LinkState["state"] =>
  row.used_at ? "used" : row.expires_at > at ? "active" : "expired";

/** Each member's newest review link and its state (CRM-085); members who never had one are absent. */
export function reviewLinkStates({ db, actor }: Ctx): Record<string, LinkState> {
  requireAdmin(db, actor);
  const rows = db.prepare(`select member_id, created_at, expires_at, used_at from member_links l where purpose = 'review'
    and rowid = (select max(rowid) from member_links where member_id = l.member_id and purpose = 'review')`).all() as
    (Omit<LinkState, "state"> & { member_id: string })[];
  const at = now();
  return Object.fromEntries(rows.map(({ member_id, ...row }) => [member_id, { ...row, state: linkState(row, at) }]));
}

/** Reviews nobody has handled yet, newest first (CRM-034, CRM-096). */
export function adminReviews({ db, actor }: Ctx): AdminReview[] {
  requireAdmin(db, actor);
  const rows = db.prepare(`select r.id, r.member_id, p.full_name, r.answers, r.created_at from member_reviews r join profiles p on p.id = r.member_id
    where r.status = 'new' order by r.created_at desc, r.rowid desc`).all() as (Omit<AdminReview, "answers"> & { answers: string })[];
  return rows.map((r) => ({ ...r, answers: JSON.parse(r.answers) as AdminReview["answers"] }));
}

export function markReviewDone({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("review");
  db.prepare("update member_reviews set status = 'done' where id = ?").run(str(input.id, "review", 64));
}

// ---------- The token holder ----------

/** The live review link behind a token, for a member who is still approved; undefined for anything else. */
function activeLink(db: DB, token: unknown): { id: string; member_id: string } | undefined {
  if (typeof token !== "string" || !TOKEN.test(token)) return undefined;
  return db.prepare(`select l.id, l.member_id from member_links l join profiles p on p.id = l.member_id
    where l.token_hash = ? and l.purpose = 'review' and l.used_at is null and l.expires_at > ? and p.status = 'approved'`)
    .get(hashToken(token), now()) as { id: string; member_id: string } | undefined;
}

/**
 * Her own details to prefill the form (OPS-143): the profile, gaps filled from her newest approved application.
 * Null when the token doesn't open the form. Reading never uses the link up.
 */
export function openReview({ db }: Ctx, input: unknown): ReviewPrefill | null {
  const link = activeLink(db, isObject(input) ? input.token : undefined);
  if (!link) return null;
  const p = db.prepare(`select p.full_name, p.business, p.role_title, p.website, p.neighborhood, u.email from profiles p join "user" u on u.id = p.id
    where p.id = ?`).get(link.member_id) as { full_name: string; business: string; role_title: string; website: string; neighborhood: string | null; email: string };
  const app = db.prepare(`select full_name, neighborhood, answers from applications where user_id = ? and status = 'approved'
    order by created_at desc limit 1`).get(link.member_id) as { full_name: string; neighborhood: string; answers: string } | undefined;
  const a = (app ? JSON.parse(app.answers) : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const values: Record<InfoField, string> = {
    full_name: p.full_name || s(app?.full_name),
    email: p.email,
    business_practice: p.business || s(a.business),
    profession_role: p.role_title || s(a.role),
    website_social: p.website || s(a.website) || s(a.instagram),
    neighborhood_city: p.neighborhood || s(app?.neighborhood) || s(a.basedIn),
    interests: "",
  };
  for (const { name } of INFO_FIELDS) values[name] = values[name].slice(0, 300);
  return { firstName: values.full_name.split(/\s+/)[0] || "there", values };
}

const isBot = (input: Record<string, unknown>) => input.honeypot !== undefined && input.honeypot !== "" && input.honeypot !== null;

/**
 * Stores her review and uses the link up, in one transaction: the conditional update is the single-use check, so
 * two sends racing on one link store one review (OPS-088). Her profile is never touched — a person acts on it.
 */
export function submitReview({ db }: Ctx, input: unknown): void {
  if (!isObject(input)) throw bad("review");
  if (isBot(input)) return;
  const link = activeLink(db, input.token);
  if (!link) throw invalidLink();
  const checked = checkReview(input);
  if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
  const at = now();
  tx(db, () => {
    const used = db.prepare("update member_links set used_at = ? where id = ? and used_at is null and expires_at > ?").run(at, link.id, at).changes;
    if (!used) throw invalidLink();
    db.prepare("insert into member_reviews (link_id, member_id, answers, form_version, created_at) values (?, ?, ?, ?, ?)")
      .run(link.id, link.member_id, JSON.stringify(checked.value), FORM_VERSION, at);
  });
}

// ponytail: 10 per client IP per 10 minutes, in memory (see rateLimit); generous because a link opens once anyway.
const limit = rateLimit(10, 10 * 60 * 1000);

/** POST /api/review (JSON, ≤ 32 KB, the old intake's cap): size and the per-IP limit are checked before the body is read. */
export function reviewRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, 32 * 1024);
    if (!limit(clientIp(request.headers))) throw new HttpError("Too many tries from here. Please try again later.", 429);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw bad("review");
    }
    submitReview(c, input);
  });
}
