import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import type { Ctx } from "@/server/context.server";
import { isPinOpen } from "@/server/pin-open";
import { EVE_OPERATIONS } from "./catalog.server";
import { decideProposal, listProposals, propose, proxyEve, redact, shapeRead, signEveToken, SESSION_AUDIENCE, TOOL_AUDIENCE, toolRequest, verifyEveToken } from "./eve.server";
import { isSitePath, safeCssColor, safeCssKey, safeHref, safeImage } from "./genui/safe";

const SECRET = "s".repeat(40);
const ADMIN = "00000000-0000-4000-8000-00000000000a";
const OTHER_ADMIN = "00000000-0000-4000-8000-00000000000b";
const MEMBER = "00000000-0000-4000-8000-00000000000c";

let db: DB;
const as = (id: string | null): Ctx => ({ db, actor: id ? { id, email: `${id}@x.test` } : null });
const statusOf = (id: string) => (db.prepare("select status, input from eve_proposals where id = ?").get(id) as { status: string; input: string });
const noteCount = () => (db.prepare("select count(*) as n from admin_notes").get() as { n: number }).n;
const tool = (token: string, body: unknown) => {
  const text = JSON.stringify(body);
  return toolRequest(db, new Request("http://app.test/api/eve-tools", {
    method: "POST", body: text,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "content-length": String(Buffer.byteLength(text)) },
  }));
};

beforeEach(() => {
  vi.stubEnv("EVE_SHARED_SECRET", SECRET);
  vi.stubEnv("EVE_URL", "http://eve.invalid");
  db = openDb(":memory:");
  const now = new Date().toISOString();
  for (const id of [ADMIN, OTHER_ADMIN, MEMBER]) {
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'X', ?, 1, ?, ?)`).run(id, `${id}@x.test`, now, now);
  }
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin'), (?, 'admin')").run(ADMIN, OTHER_ADMIN);
  db.prepare("update profiles set full_name = 'Rosa Member', status = 'approved' where id = ?").run(MEMBER);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Eve tokens", () => {
  it("accepts its own token and refuses a forged, expired or wrong-audience one", () => {
    const token = signEveToken(ADMIN, TOOL_AUDIENCE, SECRET);
    expect(verifyEveToken(token, TOOL_AUDIENCE, SECRET)).toBe(ADMIN);
    expect(verifyEveToken(token, SESSION_AUDIENCE, SECRET)).toBeNull();
    expect(verifyEveToken(token, TOOL_AUDIENCE, "x".repeat(40))).toBeNull();
    expect(verifyEveToken(token, TOOL_AUDIENCE, SECRET, Date.now() + 301_000)).toBeNull();
    expect(verifyEveToken(`${token}.extra`, TOOL_AUDIENCE, SECRET)).toBeNull();
  });
});

describe("the Eve service calling the app", () => {
  it("refuses no token, and a valid token for someone who isn't an admin", async () => {
    expect((await tool("nope", { action: "catalog" })).status).toBe(401);
    expect((await tool(signEveToken(MEMBER, TOOL_AUDIENCE, SECRET), { action: "catalog" })).status).toBe(403);
  });

  it("can't run a write through a read, or a name that isn't in the catalogue", async () => {
    const token = signEveToken(ADMIN, TOOL_AUDIENCE, SECRET);
    expect((await tool(token, { action: "read", operation: "add_note", input: { memberId: MEMBER, body: "x" } })).status).toBe(400);
    expect((await tool(token, { action: "read", operation: "constructor" })).status).toBe(400);
    expect((await tool(token, { action: "propose", operation: "list_members", input: {} })).status).toBe(400);
    expect(noteCount()).toBe(0);
  });

  it("a proposal changes nothing until the admin confirms it", async () => {
    const token = signEveToken(ADMIN, TOOL_AUDIENCE, SECRET);
    const response = await tool(token, { action: "propose", operation: "add_note", input: { memberId: MEMBER, body: "Met at the salon" } });
    const { proposalId, status } = await response.json() as { proposalId: string; status: string };
    expect(status).toBe("waiting_for_admin");
    expect(noteCount()).toBe(0);
    expect(listProposals(as(ADMIN))[0]).toMatchObject({ id: proposalId, label: "Add a private note", subject: "Rosa Member" });
    expect(await decideProposal(as(ADMIN), proposalId, "confirm")).toMatchObject({ ok: true });
    expect(noteCount()).toBe(1);
    expect(statusOf(proposalId)).toEqual({ status: "done", input: "{}" });
  });
});

describe("confirming a proposal", () => {
  const note = () => propose(as(ADMIN), "add_note", { memberId: MEMBER, body: "note" }).proposalId;

  it("only the admin who asked can decide it", async () => {
    const id = note();
    await expect(decideProposal(as(OTHER_ADMIN), id, "confirm")).rejects.toThrow(/wasn’t found/);
    await expect(decideProposal(as(MEMBER), id, "confirm")).rejects.toThrow(/admins only/i);
    await expect(decideProposal(as(null), id, "confirm")).rejects.toThrow(/sign in/i);
    expect(listProposals(as(OTHER_ADMIN))).toEqual([]);
    expect(noteCount()).toBe(0);
  });

  it("runs once, however many times it is clicked", async () => {
    const id = note();
    const results = await Promise.allSettled([decideProposal(as(ADMIN), id, "confirm"), decideProposal(as(ADMIN), id, "confirm")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(noteCount()).toBe(1);
  });

  it("an expired or cancelled one never runs, and its input is cleared", async () => {
    const expired = note();
    await expect(decideProposal(as(ADMIN), expired, "confirm", Date.now() + 16 * 60_000)).rejects.toThrow(/expired/);
    const cancelled = note();
    await decideProposal(as(ADMIN), cancelled, "cancel");
    await expect(decideProposal(as(ADMIN), cancelled, "confirm")).rejects.toThrow(/already handled/);
    expect(statusOf(cancelled)).toEqual({ status: "cancelled", input: "{}" });
    listProposals(as(ADMIN), Date.now() + 16 * 60_000);
    expect(statusOf(expired)).toEqual({ status: "expired", input: "{}" });
    expect(noteCount()).toBe(0);
  });

  it("a failed change is reported and recorded, not retried", async () => {
    const id = propose(as(ADMIN), "add_note", { memberId: MEMBER, body: "" }).proposalId;
    expect(await decideProposal(as(ADMIN), id, "confirm")).toMatchObject({ ok: false });
    expect(statusOf(id).status).toBe("failed");
  });

  it("a personal link goes to the admin's screen only", async () => {
    const id = propose(as(ADMIN), "mint_personal_link", { member_id: MEMBER }).proposalId;
    const decided = await decideProposal(as(ADMIN), id, "confirm");
    expect((decided.result as { url: string }).url).toMatch(/\/review\?t=/);
    expect(statusOf(id).input).toBe("{}");
    const other = propose(as(ADMIN), "add_note", { memberId: MEMBER, body: "x" }).proposalId;
    expect((await decideProposal(as(ADMIN), other, "confirm")).result).toBeUndefined();
  });
});

describe("what the model can read", () => {
  it("drops credential-like fields at any depth", () => {
    expect(redact({ name: "A", token_hash: "x", nested: [{ password: "y", ok: 1 }] })).toEqual({ name: "A", nested: [{ ok: 1 }] });
  });

  it("pages and searches lists", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ name: i === 42 ? "Rosa Park" : `Member ${i}` }));
    expect(shapeRead(rows)).toMatchObject({ total: 60, offset: 0, items: { length: 25 } });
    expect(shapeRead(rows, { query: "rosa park" })).toEqual({ total: 1, offset: 0, items: [{ name: "Rosa Park" }] });
  });

  it("every write in the catalogue is marked as one, and destructive ones say so", () => {
    for (const name of ["cancel_event", "delete_form", "delete_post", "delete_reply", "delete_note"]) {
      expect(EVE_OPERATIONS[name]).toMatchObject({ kind: "write", destructive: true });
    }
    for (const name of ["decline_and_email", "send_approval_email", "cancel_event"]) expect(EVE_OPERATIONS[name].notifies).toBe(true);
  });
});

describe("the browser's proxy to Eve", () => {
  const post = (path: string) => new Request(`http://app.test/api/eve/${path}`, { method: "POST", body: "{}", headers: { "content-length": "2" } });

  it("refuses anyone but an admin before reaching Eve", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    expect((await proxyEve(as(null), post("v1/session"), "v1/session")).status).toBe(401);
    expect((await proxyEve(as(MEMBER), post("v1/session"), "v1/session")).status).toBe(403);
    expect(network).not.toHaveBeenCalled();
  });

  it("forwards only the chat routes", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    for (const path of ["v1/health", "v1/session/abc/clear", "../secrets", "v1/session/a/b/c"]) {
      expect((await proxyEve(as(ADMIN), post(path), path)).status).toBe(404);
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("one admin's conversation is closed to another", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ sessionId: "session-1" })));
    expect((await proxyEve(as(ADMIN), post("v1/session"), "v1/session")).status).toBe(200);
    expect((await proxyEve(as(OTHER_ADMIN), post("v1/session/session-1"), "v1/session/session-1")).status).toBe(404);
    expect((await proxyEve(as(ADMIN), post("v1/session/session-1"), "v1/session/session-1")).status).toBe(200);
  });

  it("says so when Eve isn't set up", async () => {
    vi.stubEnv("EVE_SHARED_SECRET", "");
    expect((await proxyEve(as(ADMIN), post("v1/session"), "v1/session")).status).toBe(503);
  });
});

describe("routes", () => {
  it("the browser's Eve routes are under the CSRF check", () => {
    const source = readFileSync(new URL("../../start.ts", import.meta.url), "utf8");
    const pattern = new RegExp(/API_ROUTES = \/(.+)\/i;/.exec(source)![1], "i");
    expect(pattern.test("/api/eve/v1/session")).toBe(true);
    expect(pattern.test("/api/eve-proposals")).toBe(true);
  });

  it("the PIN leaves open only the token-checked service route", () => {
    expect(isPinOpen("/api/eve-tools")).toBe(true);
    expect(isPinOpen("/api/eve/v1/session")).toBe(false);
    expect(isPinOpen("/api/eve-proposals")).toBe(false);
  });
});

describe("Eve's rendered answers", () => {
  it("loads images only from this site's uploads", () => {
    expect(safeImage("/media/public/a.webp")).toBe("/media/public/a.webp");
    for (const src of ["https://evil.test/x.png?d=secret", "//evil.test/x.png", "/\\evil.test/x.png", "/assets/x.png", "data:image/png;base64,AA"]) {
      expect(safeImage(src)).toBeUndefined();
    }
  });

  it("keeps links on this site or plain mailto", () => {
    expect(safeHref("/admin/people")).toBe("/admin/people");
    expect(safeHref("mailto:a@b.test")).toBe("mailto:a@b.test");
    for (const href of ["https://evil.test", "//evil.test", "javascript:alert(1)", "mailto:a@b.test?body=secret"]) expect(safeHref(href)).toBeUndefined();
    expect(isSitePath("/\\evil.test")).toBe(false);
  });

  it("refuses anything that could break out of a chart's style block", () => {
    expect(safeCssKey("series_1")).toBe(true);
    expect(safeCssKey("x;}</style><script>")).toBe(false);
    expect(safeCssColor("#ff0000")).toBe(true);
    expect(safeCssColor("oklch(0.5 0.1 20)")).toBe(true);
    expect(safeCssColor("url(https://evil.test/x)")).toBe(false);
    expect(safeCssColor("red;}</style>")).toBe(false);
  });
});
