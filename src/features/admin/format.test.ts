import { describe, expect, it } from "vitest";
import {
  LOGO_MAX_BYTES, attachEmails, checkLogo, formatAnswers, humanizeKey, logoPath, reviewerName, sortApplications,
  validateNeighborhood,
} from "./format";

const app = (id: string, status: "pending" | "approved" | "declined", created_at: string) => ({ id, status, created_at });

describe("sortApplications", () => {
  it("puts pending first, then newest first within each group", () => {
    const sorted = sortApplications([
      app("old-approved", "approved", "2026-01-01T00:00:00Z"),
      app("old-pending", "pending", "2026-02-01T00:00:00Z"),
      app("new-declined", "declined", "2026-05-01T00:00:00Z"),
      app("new-pending", "pending", "2026-04-01T00:00:00Z"),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["new-pending", "old-pending", "new-declined", "old-approved"]);
  });

  it("does not mutate its input", () => {
    const input = [app("a", "approved", "2026-01-01T00:00:00Z"), app("b", "pending", "2026-01-02T00:00:00Z")];
    sortApplications(input);
    expect(input.map((a) => a.id)).toEqual(["a", "b"]);
  });
});

describe("humanizeKey", () => {
  it.each([
    ["preferredName", "Preferred name"],
    ["idealReferral", "Ideal referral"],
    ["some_snake_key", "Some snake key"],
    ["kebab-key", "Kebab key"],
    ["whatsapp", "WhatsApp"],
    ["linkedin", "LinkedIn"],
  ])("%s → %s", (key, label) => {
    expect(humanizeKey(key)).toBe(label);
  });
});

describe("formatAnswers", () => {
  it("humanises keys, lists arrays, says Yes/No for booleans and skips empty values", () => {
    expect(
      formatAnswers({
        preferredName: "Ro",
        industry: ["Food", "Retail"],
        communityGuidelines: true,
        coffee: "",
        events: [],
        pronouns: null,
        newsletter: { subscribe: false },
      }),
    ).toEqual([
      { key: "preferredName", label: "Preferred name", value: "Ro" },
      { key: "industry", label: "Industry", value: ["Food", "Retail"] },
      { key: "communityGuidelines", label: "Community guidelines", value: "Yes" },
      { key: "newsletter.subscribe", label: "Newsletter · Subscribe", value: "No" },
    ]);
  });

  it("flattens nested answers and tolerates unknown keys", () => {
    expect(
      formatAnswers({
        whatsapp: { join: true, number: "718", numberVisible: true },
        directory: { choice: "yes", headshot: { paidSession: true }, publicFields: ["Email", ""] },
        brandNewQuestion: 3,
      }),
    ).toEqual([
      { key: "whatsapp.join", label: "WhatsApp · Join", value: "Yes" },
      { key: "whatsapp.number", label: "WhatsApp · Number", value: "718" },
      { key: "whatsapp.numberVisible", label: "WhatsApp · Number visible", value: "Yes" },
      { key: "directory.choice", label: "Directory · Choice", value: "yes" },
      { key: "directory.headshot.paidSession", label: "Directory · Headshot · Paid session", value: "Yes" },
      { key: "directory.publicFields", label: "Directory · Public fields", value: ["Email"] },
      { key: "brandNewQuestion", label: "Brand new question", value: "3" },
    ]);
  });

  it("returns nothing for a non-object", () => {
    expect(formatAnswers(null)).toEqual([]);
    expect(formatAnswers("text")).toEqual([]);
    expect(formatAnswers([1, 2])).toEqual([]);
  });
});

describe("attachEmails", () => {
  it("attaches the applicant email by user id, null when there is none", () => {
    const profiles = [{ id: "u1", full_name: "Rosa" }, { id: "u2", full_name: "Lena" }];
    const apps = [{ user_id: null, email: "anon@x.test" }, { user_id: "u1", email: "rosa@x.test" }];
    expect(attachEmails(profiles, apps)).toEqual([
      { id: "u1", full_name: "Rosa", email: "rosa@x.test" },
      { id: "u2", full_name: "Lena", email: null },
    ]);
  });
});

describe("reviewerName", () => {
  const members = [{ id: "admin-1", full_name: "Natasa" }, { id: "u2", full_name: "" }];
  it("names a known reviewer and stays silent otherwise", () => {
    expect(reviewerName("admin-1", members)).toBe("Natasa");
    expect(reviewerName("u2", members)).toBeUndefined();
    expect(reviewerName("someone-else", members)).toBeUndefined();
    expect(reviewerName(null, members)).toBeUndefined();
  });
});

describe("validateNeighborhood", () => {
  const ok = { name: "Woodside", slug: "woodside", color: "#12aBcd" };

  it("accepts a valid neighborhood", () => {
    expect(validateNeighborhood(ok)).toBeNull();
    expect(validateNeighborhood({ ...ok, slug: "long-island-city-2" })).toBeNull();
  });

  it.each(["Woodside", "wood side", "-woodside", "woodside-", "wood--side", "wood_side", ""])("rejects the slug %j", (slug) => {
    expect(validateNeighborhood({ ...ok, slug })).toMatch(/slug/i);
  });

  it.each(["#fff", "12abcd", "#12abcg", "#12abcd0", "red", ""])("rejects the color %j", (color) => {
    expect(validateNeighborhood({ ...ok, color })).toMatch(/color/i);
  });

  it("requires a name of at most 60 characters", () => {
    expect(validateNeighborhood({ ...ok, name: "  " })).toMatch(/name/i);
    expect(validateNeighborhood({ ...ok, name: "x".repeat(61) })).toMatch(/name/i);
  });

  it("can skip the slug for an existing row", () => {
    expect(validateNeighborhood({ name: "Woodside", color: "#123456" })).toBeNull();
  });
});

describe("checkLogo", () => {
  it.each([
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("accepts %s and names it by type", (type, ext) => {
    const file = new File(["x"], "logo.anything", { type });
    expect(checkLogo(file)).toBe(ext);
    expect(logoPath("woodside", file)).toBe(`woodside.${ext}`);
  });

  it.each(["image/jpeg", "image/svg+xml", ""])("rejects %j with a clear message", (type) => {
    expect(() => checkLogo(new File(["x"], "logo", { type }))).toThrow(/PNG or WebP/);
  });

  it("rejects a file over 2 MB", () => {
    const big = new File([new Uint8Array(LOGO_MAX_BYTES + 1)], "logo.png", { type: "image/png" });
    expect(() => checkLogo(big)).toThrow(/2 MB/);
  });
});
