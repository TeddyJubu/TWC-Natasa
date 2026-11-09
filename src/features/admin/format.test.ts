import { describe, expect, it } from "vitest";
import {
  LOGO_MAX_BYTES, applicationOrigin, attachEmails, checkLogo, describeAction, duplicatesOf, formatAnswers, isCalendarDate,
  newsletterLabel, humanizeKey, logoPath, matchesSearch, newestByUser, reviewerName, sortApplications, subscriberConsentLabel,
  toCsv, validateNeighborhood,
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
  it("shows imported answers in the CRM's words and hides what the CRM hid (CRM-032)", () => {
    expect(formatAnswers({
      full_name: "Rosa", base_area: "Astoria", goal_labels: ["Friends", "Clients"], goal_codes: ["f", "c"], coffee_chat: "either",
      _ua: "x", ip: "1.2.3.4", review_token: "t", electronic_signature: "Rosa", signature_date: "2025-01-02", zip: "11103",
      legacy: { id: "app-1", origin: "Old HeyForm" },
    })).toEqual([
      { key: "full_name", label: "Name", value: "Rosa" },
      { key: "base_area", label: "Based in", value: "Astoria" },
      { key: "goal_labels", label: "Hoping to find", value: ["Friends", "Clients"] },
      { key: "coffee_chat", label: "Open to coffee chats", value: "either" },
      { key: "zip", label: "Zip", value: "11103" },
    ]);
  });

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

describe("matchesSearch", () => {
  const fields = ["Zoë Álvarez", "zoe@bakery.test", "Sourdough & Co"];
  it("matches every word, case- and accent-insensitively, across name, email and business", () => {
    expect(matchesSearch("", fields)).toBe(true);
    expect(matchesSearch("  ZOE  alvarez ", fields)).toBe(true);
    expect(matchesSearch("bakery.test sourdough", fields)).toBe(true);
    expect(matchesSearch("zoe greenpoint", fields)).toBe(false);
    expect(matchesSearch("co", [null, undefined, "Co-op"])).toBe(true);
  });
});

describe("toCsv", () => {
  it("quotes every cell, doubles quotes, defuses formulas, BOM + CRLF", () => {
    expect(toCsv(["a", "b"], [['say "hi"', null], ["=1+1", 3], ["-2", "line\nbreak"]])).toBe(
      '\uFEFF"a","b"\r\n"say ""hi""",""\r\n"\'=1+1","3"\r\n"\'-2","line\nbreak"\r\n',
    );
  });
});

describe("applicationOrigin", () => {
  it("is the import's origin label, else Join form", () => {
    expect(applicationOrigin({ legacy: { origin: "Imported list" } })).toBe("Imported list");
    expect(applicationOrigin({ legacy: { origin: " " } })).toBe("Join form");
    expect(applicationOrigin({ phone: "1" })).toBe("Join form");
    expect(applicationOrigin(null)).toBe("Join form");
  });
});

describe("newestByUser", () => {
  it("keeps each member's newest linked application and ignores unlinked ones", () => {
    const apps = [
      { id: "old", user_id: "u1", created_at: "2025-01-01" },
      { id: "new", user_id: "u1", created_at: "2025-03-01" },
      { id: "mid", user_id: "u1", created_at: "2025-02-01" },
      { id: "free", user_id: null, created_at: "2025-04-01" },
      { id: "u2", user_id: "u2", created_at: "2024-01-01" },
    ];
    const byUser = newestByUser(apps);
    expect([...byUser].map(([u, a]) => [u, a.id])).toEqual([["u1", "new"], ["u2", "u2"]]);
  });
});

describe("duplicatesOf (CRM-072/073, by email)", () => {
  const a = (id: string, email: string, status: "pending" | "approved" | "declined" = "pending", user_id: string | null = null) => ({ id, email, status, user_id });
  it("flags a pending application from a member's email or account, else repeats among pending ones; never a reviewed one", () => {
    const flags = duplicatesOf([
      a("member-email", "Ada@X.test"), a("member-account", "other@x.test", "pending", "u-ada"),
      a("twice-1", "bo@x.test"), a("twice-2", "BO@x.test"), a("reviewed", "bo@x.test", "declined"),
      a("alone", "cy@x.test"), a("approved", "ada@x.test", "approved"),
    ], new Set(["ada@x.test"]), new Set(["u-ada"]));
    expect(Object.fromEntries(flags)).toEqual({ "member-email": "member", "member-account": "member", "twice-1": "applications", "twice-2": "applications" });
  });
});

describe("newsletterLabel", () => {
  it("tells consented, refused, imported (unrecorded) and absent apart", () => {
    expect([{ consent: 1 as const }, { consent: 0 as const }, { consent: null }, null].map(newsletterLabel)).toEqual([
      "Newsletter (consented)", "Newsletter (no consent)", "Newsletter (imported, consent not recorded)", "Not on the newsletter",
    ]);
  });
});

describe("subscriberConsentLabel / isCalendarDate (CRM-093 / CRM-057)", () => {
  it("labels newsletter consent for the subscribers card", () => {
    expect([subscriberConsentLabel(1), subscriberConsentLabel(0), subscriberConsentLabel(null)]).toEqual([
      "Consented", "No consent", "Imported — consent unknown",
    ]);
  });
  it("accepts real YYYY-MM-DD days and rejects impossible ones", () => {
    expect(isCalendarDate("2026-11-09")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("9 Nov 2026")).toBe(false);
  });
});

describe("describeAction", () => {
  const d = (action: Parameters<typeof describeAction>[0]["action"], over: Partial<Parameters<typeof describeAction>[0]> = {}) =>
    describeAction({ action, application_id: null, detail: "", subject_name: "Nia", ...over });
  it("says what happened to whom, and survives a removed subject", () => {
    expect(d("approved", { application_id: "x" })).toBe("approved Nia’s application");
    expect(d("declined")).toBe("declined Nia");
    expect(d("pending")).toBe("put Nia back to pending");
    expect(d("note_added", { application_id: "x" })).toBe("added a note on Nia’s application");
    expect(d("note_deleted")).toBe("deleted a note on Nia");
    expect(d("neighborhood", { detail: "Astoria" })).toBe("set Nia’s neighborhood to Astoria");
    expect(d("neighborhood")).toBe("cleared Nia’s neighborhood");
    expect(d("approved", { application_id: "x", subject_name: null })).toBe("approved a removed application");
    expect(d("neighborhood", { subject_name: null, detail: "Astoria" })).toBe("set a removed member’s neighborhood to Astoria");
  });
});
