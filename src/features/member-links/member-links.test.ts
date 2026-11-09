// Personal review links end to end on a real (in-memory) database: hash-only storage, single use, expiry, revoke,
// one live link per member, the neutral answer for every bad token, and a review that never touches the profile.
import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import type { Ctx } from "@/server/context.server";
import {
  INVALID_LINK, adminReviews, markReviewDone, mintReviewLink, openReview, reviewLinkStates, reviewRequest, revokeReviewLink, submitReview,
} from "./member-links.server";
import { checkReview, reviewEntries } from "./schema";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const [ADMIN, BEA, PENDING] = [id("a"), id("b"), id("c")];
let db: DB;
const as = (who: string | null): Ctx => ({ db, actor: who ? { id: who, email: `${who}@x.test` } : null });
const addUser = (who: string, email: string) =>
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, '', ?, 1, ?, ?)`).run(who, email, "2026-01-01", "2026-01-01");
const tokenOf = (url: string) => new URL(url).searchParams.get("t")!;
const answers = (extra: Record<string, unknown> = {}) => ({ full_name: "Bea Lopez", email: "Bea@X.test", membership: "keep", ...extra });
const profile = () => db.prepare("select full_name, business, status from profiles where id = ?").get(BEA);

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://new.example/");
  db = openDb(":memory:");
  addUser(ADMIN, "admin@x.test");
  addUser(BEA, "bea@x.test");
  addUser(PENDING, "pending@x.test");
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
  db.prepare("update profiles set status = 'approved', full_name = 'Bea Lopez', business = 'Bea’s Books' where id = ?").run(BEA);
});
afterAll(() => vi.unstubAllEnvs());

describe("minting", () => {
  it("is admin-only, and only for approved members", () => {
    expect(() => mintReviewLink(as(null), { member_id: BEA })).toThrow(/sign in/i);
    expect(() => mintReviewLink(as(BEA), { member_id: BEA })).toThrow(/Admins only/);
    expect(() => mintReviewLink(as(ADMIN), { member_id: PENDING })).toThrow(/approved members/);
    expect(() => mintReviewLink(as(ADMIN), { member_id: 42 })).toThrow(/Invalid member/);
  });

  it("returns the URL once and stores only the token's SHA-256", () => {
    const { url, expires_at } = mintReviewLink(as(ADMIN), { member_id: BEA });
    expect(url).toMatch(/^https:\/\/new\.example\/review\?t=[A-Za-z0-9_-]{43}$/);
    const row = db.prepare("select * from member_links").get() as Record<string, string>;
    expect(row.token_hash).toBe(createHash("sha256").update(tokenOf(url)).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(tokenOf(url));
    expect(row).toMatchObject({ member_id: BEA, purpose: "review", created_by: ADMIN, used_at: null, expires_at });
    expect(Date.parse(expires_at) - Date.now()).toBeGreaterThan(29 * 86_400_000);
  });

  it("retires her previous live link (one live link per kind)", () => {
    const first = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    const second = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    expect(openReview(as(null), { token: first })).toBeNull();
    expect(openReview(as(null), { token: second })).not.toBeNull();
    expect(reviewLinkStates(as(ADMIN))[BEA]!.state).toBe("active");
  });
});

describe("the token holder", () => {
  it("opens her own prefilled form, any number of times, without a session", () => {
    const token = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    const prefill = openReview(as(null), { token });
    expect(prefill).toMatchObject({ firstName: "Bea", values: { full_name: "Bea Lopez", email: "bea@x.test", business_practice: "Bea’s Books" } });
    expect(openReview(as(null), { token })).toEqual(prefill);
    expect(reviewLinkStates(as(ADMIN))[BEA]!.state).toBe("active");
  });

  it("fills gaps from her approved application", () => {
    db.prepare("insert into applications (user_id, email, full_name, neighborhood, answers, status) values (?, 'bea@x.test', 'Bea Lopez', 'Astoria', ?, 'approved')")
      .run(BEA, JSON.stringify({ role: "Owner", website: "https://bea.example" }));
    const token = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    expect(openReview(as(null), { token })!.values).toMatchObject({ profession_role: "Owner", website_social: "https://bea.example", neighborhood_city: "Astoria" });
  });

  it("sends one review: stored, link used, profile untouched", () => {
    const token = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    const before = profile();
    submitReview(as(null), { token, ...answers({ full_name: "Bea L.", membership: "leave", correction_requests: ["req_record_removal"] }) });
    expect(profile()).toEqual(before);
    expect(reviewLinkStates(as(ADMIN))[BEA]!.state).toBe("used");
    const [review] = adminReviews(as(ADMIN));
    expect(review).toMatchObject({ member_id: BEA, full_name: "Bea Lopez" });
    expect(review!.answers).toMatchObject({ full_name: "Bea L.", email: "bea@x.test", membership: "leave", correction_requests: ["req_record_removal"] });
    expect(review!.answers).not.toHaveProperty("token");
    expect(() => submitReview(as(null), { token, ...answers() })).toThrow(INVALID_LINK);
    expect(openReview(as(null), { token })).toBeNull();
    expect(adminReviews(as(ADMIN))).toHaveLength(1);
  });

  it("gives the same answer for unknown, malformed, expired, revoked, spotlight and no-longer-member tokens", () => {
    const fresh = () => tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    const bad: unknown[] = ["x".repeat(43), "short", 42, undefined];
    const expired = fresh();
    db.prepare("update member_links set expires_at = '2000-01-01T00:00:00.000Z'").run();
    bad.push(expired);
    const revoked = fresh();
    expect(revokeReviewLink(as(ADMIN), { member_id: BEA })).toBe(1);
    bad.push(revoked);
    const spotlight = fresh();
    db.prepare("update member_links set purpose = 'spotlight' where used_at is null and expires_at > ?").run(new Date().toISOString());
    bad.push(spotlight);
    const declined = fresh();
    db.prepare("update profiles set status = 'declined' where id = ?").run(BEA);
    bad.push(declined);
    for (const token of bad) {
      expect(openReview(as(null), { token })).toBeNull();
      expect(() => submitReview(as(null), { token, ...answers() })).toThrow(INVALID_LINK);
    }
    expect(adminReviews(as(ADMIN))).toEqual([]);
  });

  it("a bot (honeypot) gets success with nothing stored and the link still open", () => {
    const token = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    submitReview(as(null), { token, ...answers(), honeypot: "spam" });
    expect(adminReviews(as(ADMIN))).toEqual([]);
    expect(openReview(as(null), { token })).not.toBeNull();
  });

  it("a review that fails its check leaves the link open", () => {
    const token = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    expect(() => submitReview(as(null), { token, ...answers({ membership: "" }) })).toThrow(/stay connected/);
    expect(openReview(as(null), { token })).not.toBeNull();
  });

  it("POST /api/review answers 404 for a bad link and 204 once stored", async () => {
    const token = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    const post = (body: unknown) => {
      const text = JSON.stringify(body);
      return reviewRequest(as(null), new Request("https://new.example/api/review", {
        method: "POST", body: text, headers: { "content-type": "application/json", "content-length": String(text.length), "cf-connecting-ip": "203.0.113.9" },
      }));
    };
    expect((await post({ token: "x".repeat(43), ...answers() })).status).toBe(404);
    expect((await post({ token, ...answers() })).status).toBe(204);
    expect((await post({ token, ...answers() })).status).toBe(404);
  });
});

describe("admin reviews", () => {
  it("are admin-only, and Mark handled takes one off the list", () => {
    const token = tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA }).url);
    submitReview(as(null), { token, ...answers() });
    expect(() => adminReviews(as(BEA))).toThrow(/Admins only/);
    expect(() => reviewLinkStates(as(null))).toThrow(/sign in/i);
    expect(() => revokeReviewLink(as(BEA), { member_id: BEA })).toThrow(/Admins only/);
    const [review] = adminReviews(as(ADMIN));
    expect(() => markReviewDone(as(BEA), { id: review!.id })).toThrow(/Admins only/);
    markReviewDone(as(ADMIN), { id: review!.id });
    expect(adminReviews(as(ADMIN))).toEqual([]);
  });
});

describe("checkReview", () => {
  it("needs a name, a valid email and a membership choice", () => {
    expect(checkReview({})).toEqual({ errors: {
      full_name: "Please tell us your name.", email: "Please give us your email.", membership: "Please choose whether you would like to stay connected.",
    } });
    expect(checkReview(answers({ email: "nope" }))).toHaveProperty("errors.email");
  });

  it("checks every option value (the old intake didn't) and leaves unanswered permissions out", () => {
    expect(checkReview(answers({ membership: "maybe" }))).toHaveProperty("errors.membership");
    expect(checkReview(answers({ photography: "always" }))).toHaveProperty("errors.photography");
    expect(checkReview(answers({ correction_requests: ["req_everything"] }))).toHaveProperty("errors.correction_requests");
    const ok = checkReview(answers({ newsletter: "no" }));
    expect("value" in ok && ok.value).toMatchObject({ newsletter: "no", email: "bea@x.test", public_fields: [], correction_requests: [] });
    expect("value" in ok && ok.value).not.toHaveProperty("directory");
  });

  it("a public listing needs at least one field; fields without a public listing are dropped", () => {
    expect(checkReview(answers({ directory: "public" }))).toEqual({ errors: { public_fields: expect.stringMatching(/tick at least one/) } });
    const pub = checkReview(answers({ directory: "public", public_fields: ["public_name"] }));
    expect("value" in pub && pub.value.public_fields).toEqual(["public_name"]);
    const member = checkReview(answers({ directory: "member_only", public_fields: "public_name" }));
    expect("value" in member && member.value.public_fields).toEqual([]);
  });

  it("reviewEntries labels codes for /admin", () => {
    const checked = checkReview(answers({ correction_requests: ["req_other"], other_note: "New surname" }));
    if (!("value" in checked)) throw new Error("expected a value");
    expect(reviewEntries(checked.value)).toEqual(expect.arrayContaining([
      { key: "membership", label: "Membership", value: "Yes, keep me connected to the free community of The Women’s Collective." },
      { key: "correction_requests", label: "Requests", value: ["Other request"] },
      { key: "other_note", label: "Details", value: "New surname" },
    ]));
  });
});
