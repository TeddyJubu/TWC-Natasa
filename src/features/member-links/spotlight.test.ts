// Weekly Spotlight links end to end on a real (in-memory) database: purpose-separated hashed links, single use,
// the neutral 404 for every bad token (review tokens included), answers stored under the old column names, and
// POST /api/spotlight's size cap before the body is read.
import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import type { Ctx } from "@/server/context.server";
import { mintReviewLink, openReview, reviewLinkStates, revokeReviewLink } from "./member-links.server";
import { adminSpotlights, openSpotlight, spotlightRequest, submitSpotlight } from "./spotlight.server";
import { INVALID_SPOTLIGHT, SPOTLIGHT_QUESTIONS, checkSpotlight, fieldName, spotlightEntries } from "./spotlight";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const [ADMIN, BEA] = [id("a"), id("b")];
let db: DB;
const as = (who: string | null): Ctx => ({ db, actor: who ? { id: who, email: `${who}@x.test` } : null });
const addUser = (who: string, email: string) =>
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, '', ?, 1, ?, ?)`).run(who, email, "2026-01-01", "2026-01-01");
const tokenOf = (url: string) => new URL(url).searchParams.get("t")!;
const mint = (purpose: "review" | "spotlight" = "spotlight") => tokenOf(mintReviewLink(as(ADMIN), { member_id: BEA, purpose }).url);
const story = (extra: Record<string, unknown> = {}) => ({
  full_name: "Bea Lopez", q_what_inspired_you_to_start: "Books.", q_what_are_you_currently_focused_on: "A second shop.",
  q_what_are_you_most_proud_of: "Ten years.", q_one_fact_others_should_know: "I bind them myself.", ...extra,
});
const profile = () => db.prepare("select full_name, business, status from profiles where id = ?").get(BEA);

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://new.example/");
  db = openDb(":memory:");
  addUser(ADMIN, "admin@x.test");
  addUser(BEA, "bea@x.test");
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
  db.prepare("update profiles set status = 'approved', full_name = 'Bea Lopez', business = 'Bea’s Books', neighborhood = 'Astoria' where id = ?").run(BEA);
});
afterAll(() => vi.unstubAllEnvs());

describe("Spotlight links", () => {
  it("mint a /spotlight URL, store only the hash, and live beside the review link", () => {
    const review = mint("review");
    const { url } = mintReviewLink(as(ADMIN), { member_id: BEA, purpose: "spotlight" });
    expect(url).toMatch(/^https:\/\/new\.example\/spotlight\?t=[A-Za-z0-9_-]{43}$/);
    const row = db.prepare("select * from member_links where purpose = 'spotlight'").get() as Record<string, string>;
    expect(row.token_hash).toBe(createHash("sha256").update(tokenOf(url)).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(tokenOf(url));
    // Minting (or revoking) one kind never closes the other.
    expect(openReview(as(null), { token: review })).not.toBeNull();
    expect(revokeReviewLink(as(ADMIN), { member_id: BEA, purpose: "spotlight" })).toBe(1);
    expect(openReview(as(null), { token: review })).not.toBeNull();
    expect(reviewLinkStates(as(ADMIN), { purpose: "spotlight" })[BEA]!.state).toBe("expired");
    expect(reviewLinkStates(as(ADMIN))[BEA]!.state).toBe("active");
    expect(() => mintReviewLink(as(ADMIN), { member_id: BEA, purpose: "everything" })).toThrow(/Invalid link/);
  });

  it("prefill name, business and neighborhood without using the link up", () => {
    const token = mint();
    expect(openSpotlight(as(null), { token })).toEqual({ firstName: "Bea", values: { full_name: "Bea Lopez", business: "Bea’s Books", neighborhood: "Astoria" } });
    expect(openSpotlight(as(null), { token })).not.toBeNull();
  });

  it("store one set of answers under the old column names; the link closes and the profile is untouched", () => {
    const token = mint();
    const before = profile();
    submitSpotlight(as(null), { token, ...story({ business: "B Books", q_community_never_do: "  ", q_coffee_with_interview_opt_in: "Yes" }) });
    expect(profile()).toEqual(before);
    const [s] = adminSpotlights(as(ADMIN));
    expect(s).toMatchObject({ member_id: BEA, full_name: "Bea Lopez", business: "B Books", imported: false });
    expect(s!.answers).toEqual({
      "What Inspired You to Start": "Books.", "What Are You Currently Focused On": "A second shop.", "What Are You Most Proud Of": "Ten years.",
      "One Fact Others Should Know": "I bind them myself.", "Coffee With Interview Opt-In": "Yes",
    });
    expect(openSpotlight(as(null), { token })).toBeNull();
    expect(() => submitSpotlight(as(null), { token, ...story() })).toThrow(INVALID_SPOTLIGHT);
  });

  it("give the same answer for review, unknown, revoked and no-longer-member tokens", () => {
    const bad: unknown[] = [mint("review"), "x".repeat(43), "short", undefined];
    const revoked = mint();
    revokeReviewLink(as(ADMIN), { member_id: BEA, purpose: "spotlight" });
    bad.push(revoked);
    const declined = mint();
    db.prepare("update profiles set status = 'declined' where id = ?").run(BEA);
    bad.push(declined);
    for (const token of bad) {
      expect(openSpotlight(as(null), { token })).toBeNull();
      expect(() => submitSpotlight(as(null), { token, ...story() })).toThrow(INVALID_SPOTLIGHT);
    }
    expect(adminSpotlights(as(ADMIN))).toEqual([]);
  });

  it("a bot gets success with nothing stored; a failed check leaves the link open", () => {
    const token = mint();
    expect(submitSpotlight(as(null), { token, ...story(), honeypot: "spam" })).toBeNull();
    expect(() => submitSpotlight(as(null), { token, ...story({ q_what_are_you_most_proud_of: "" }) })).toThrow(/Please answer: What are you most proud/);
    expect(adminSpotlights(as(ADMIN))).toEqual([]);
    expect(openSpotlight(as(null), { token })).not.toBeNull();
  });

  it("are listed to admins only", () => {
    expect(() => adminSpotlights(as(BEA))).toThrow(/Admins only/);
    expect(() => adminSpotlights(as(null))).toThrow(/sign in/i);
  });

  it("POST /api/spotlight: 413 before reading an oversized body, 404 for a bad link, 204 once stored", async () => {
    const token = mint();
    const post = (body: unknown, length?: number) => {
      const text = JSON.stringify(body);
      return spotlightRequest(as(null), new Request("https://new.example/api/spotlight", {
        method: "POST", body: text, headers: { "content-type": "application/json", "content-length": String(length ?? text.length), "cf-connecting-ip": "203.0.113.7" },
      }));
    };
    expect((await post({ token, ...story() }, 40_000)).status).toBe(413);
    expect((await post({ token: "x".repeat(43), ...story() })).status).toBe(404);
    expect((await post({ token, ...story() })).status).toBe(204);
    expect((await post({ token, ...story() })).status).toBe(404);
  });
});

describe("checkSpotlight", () => {
  it("names the old POST fields (q_ + the column, snake-cased)", () => {
    expect(SPOTLIGHT_QUESTIONS.map((q) => fieldName(q.key))).toEqual([
      "q_what_inspired_you_to_start", "q_what_are_you_currently_focused_on", "q_what_are_you_most_proud_of", "q_one_fact_others_should_know",
      "q_booking_promo_links", "q_coffee_with_interview_opt_in", "q_nbwc_event_promo_collaboration", "q_community_see_more_of",
      "q_community_suggestions_events", "q_community_never_do", "q_community_would_feel_magical", "q_community_north_brooklyn_means",
      "q_community_remember_you", "q_reel_upload",
    ]);
  });

  it("needs a name and the four story answers, in form order", () => {
    const result = checkSpotlight({});
    expect("errors" in result && Object.keys(result.errors)).toEqual([
      "full_name", "q_what_inspired_you_to_start", "q_what_are_you_currently_focused_on", "q_what_are_you_most_proud_of", "q_one_fact_others_should_know",
    ]);
  });

  it("checks Yes/No, the reel link and lengths", () => {
    expect(checkSpotlight(story({ q_coffee_with_interview_opt_in: "Maybe" }))).toHaveProperty("errors.q_coffee_with_interview_opt_in");
    expect(checkSpotlight(story({ q_reel_upload: "instagram.com/reel/1" }))).toEqual({ errors: { q_reel_upload: "Please enter the video link as a complete http:// or https:// link." } });
    expect(checkSpotlight(story({ q_reel_upload: "https://instagram.com/reel/1" }))).toHaveProperty("value.answers.Reel Upload");
    expect(checkSpotlight(story({ q_community_never_do: "x".repeat(2001) }))).toHaveProperty("errors.q_community_never_do");
    expect(checkSpotlight(story({ business: "x".repeat(301) }))).toHaveProperty("errors.business");
  });

  it("spotlightEntries labels known keys and keeps an old sheet's extra columns", () => {
    expect(spotlightEntries({ "Older Column": "Kept", "What Inspired You to Start": "Books.", "Reel Upload": "" })).toEqual([
      { key: "What Inspired You to Start", label: "What inspired you to start your business or practice?", value: "Books." },
      { key: "Older Column", label: "Older Column", value: "Kept" },
    ]);
  });
});
