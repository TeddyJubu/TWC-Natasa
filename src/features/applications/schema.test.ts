import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GUIDELINES, areaOfPlace, isSigningDate, parseApplication } from "./schema";

// The fixture's signing date must stay inside the one-year window whenever this runs.
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-23T12:00:00Z") }); });
afterAll(() => { vi.useRealTimers(); });

type Entries = Record<string, string | string[]>;

/** The smallest application the form accepts, plus empty optional text inputs as a browser would send them. */
const minimum: Entries = {
  "full-name": "  Rosa Diaz ",
  "preferred-name": "",
  pronouns: " ",
  email: " rosa@x.test ",
  phone: "718-555-0100",
  area: "north-brooklyn",
  neighborhood: "Williamsburg",
  connection: ["I live here", "I own a business here"],
  business: "",
  role: "Baker",
  story: "I bake bread for the block.",
  industry: ["Food and hospitality"],
  "community-goals": ["Referrals", "Clients"],
  "ideal-referral": "Cafés that need a wholesale baker.",
  "member-support": ["Give referrals"],
  partner: "no",
  newsletter: "yes",
  "newsletter-consent": "on",
  guidelines: [...GUIDELINES],
  heard: "",
  signature: "Rosa Diaz",
  date: "2026-11-08",
  "final-confirmation": "on",
};

function formData(over: Entries = {}, omit: string[] = []) {
  const fd = new FormData();
  for (const [key, value] of Object.entries({ ...minimum, ...over })) {
    if (omit.includes(key)) continue;
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

describe("areaOfPlace", () => {
  it("finds a neighborhood's area, and none for a place on neither list", () => {
    expect(areaOfPlace(" greenpoint ")?.name).toBe("North Brooklyn");
    expect(areaOfPlace("Astoria")?.name).toBe("Queens");
    for (const unknown of ["Bayside", "", null, undefined]) expect(areaOfPlace(unknown)).toBeUndefined();
  });
});

describe("parseApplication", () => {
  it("records the area of the link, and names that area when its question is left empty", () => {
    expect(parseApplication(formData({ area: "queens", neighborhood: "Astoria" })).answers.area).toBe("Queens");
    expect(() => parseApplication(formData({ area: "nope" }))).toThrow(/choose your area/i);
    expect(() => parseApplication(formData({ area: "queens", neighborhood: "Astoria" }, ["connection"]))).toThrow(/connection to Queens/);
  });

  it("parses a filled form into the typed shape, trimming strings and omitting empty optionals", () => {
    expect(parseApplication(formData())).toEqual({
      email: "rosa@x.test",
      fullName: "Rosa Diaz",
      neighborhood: "Williamsburg",
      answers: {
        phone: "718-555-0100",
        basedIn: "Williamsburg",
        area: "North Brooklyn",
        connection: ["I live here", "I own a business here"],
        role: "Baker",
        story: "I bake bread for the block.",
        industry: ["Food and hospitality"],
        communityGoals: ["Referrals", "Clients"],
        idealReferral: "Cafés that need a wholesale baker.",
        memberSupport: ["Give referrals"],
        partner: { choice: "no" },
        newsletter: { subscribe: true, emailConsent: true },
        communityGuidelines: true,
        signature: "Rosa Diaz",
        date: "2026-11-08",
        finalConfirmation: true,
      },
    });
  });

  it("keeps every value of multi-choice groups", () => {
    const { answers } = parseApplication(formData({
      industry: ["Technology", "Other"],
      "other-industry": " Robotics ",
      "contact-preference": ["Email", "Text"],
      events: ["Attend events", "Volunteer"],
    }));
    expect(answers.industry).toEqual(["Technology", "Other"]);
    expect(answers.otherIndustry).toBe("Robotics");
    expect(answers.contactPreference).toEqual(["Email", "Text"]);
    expect(answers.events).toEqual(["Attend events", "Volunteer"]);
  });

  it("stores nothing for the retired WhatsApp, spotlight, directory and headshot questions, even if an old page sends them", () => {
    const { answers } = parseApplication(formData({
      whatsapp: "yes", "whatsapp-number": "718-555-0101", spotlight: "yes", "spotlight-focus": "My sourdough",
      directory: "yes", "directory-bio": "Rosa bakes.", services: "Bread", "headshot-contact": "Email",
    }));
    for (const key of ["whatsapp", "spotlight", "directory"]) expect(answers).not.toHaveProperty(key);
    expect(answers.newsletter).toEqual({ subscribe: true, emailConsent: true });
    expect(parseApplication(formData({ newsletter: "no" }, ["newsletter-consent"])).answers.newsletter).toEqual({ subscribe: false });
  });

  it("stores the chosen neighborhood as both the column and the answer", () => {
    const parsed = parseApplication(formData({ neighborhood: "Greenpoint" }));
    expect(parsed.neighborhood).toBe("Greenpoint");
    expect(parsed.answers.basedIn).toBe("Greenpoint");
  });

  it.each([
    ["connection", /connection to North Brooklyn/i],
    ["industry", /industry/i],
    ["community-goals", /hoping to find/i],
    ["member-support", /support other members/i],
  ])("throws a readable error when the required group %s is empty", (group, message) => {
    expect(() => parseApplication(formData({}, [group]))).toThrow(message);
  });

  it.each([
    ["no dot in the domain", "rosa@mail"],
    ["a space", "rosa mail@x.test"],
    ["no local part", "@x.test"],
    ["over 254 characters", `${"r".repeat(250)}@x.test`],
  ])("rejects an email the database would refuse (%s)", (_label, email) => {
    expect(() => parseApplication(formData({ email }))).toThrow(/email address/i);
  });

  it("throws when a required text field is blank", () => {
    expect(() => parseApplication(formData({ phone: "  " }))).toThrow(/phone number/i);
  });

  it("rejects a submission missing any one community guideline", () => {
    for (const skipped of GUIDELINES) {
      expect(() => parseApplication(formData({ guidelines: GUIDELINES.filter((g) => g !== skipped) }))).toThrow(/guideline/i);
    }
  });

  it("requires the consents a chosen section asks for", () => {
    expect(() => parseApplication(formData({ newsletter: "yes" }, ["newsletter-consent"]))).toThrow(/unsubscribe/i);
    expect(() => parseApplication(formData({}, ["final-confirmation"]))).toThrow(/confirm/i);
  });

  it("an unanswered newsletter question is no subscription, and needs no consent", () => {
    expect(parseApplication(formData({}, ["newsletter", "newsletter-consent"])).answers.newsletter).toEqual({ subscribe: false });
  });

  it.each(["61123-11-08", "2026-02-30", "2026-13-01", "11/08/2026", "2020-01-01", "2026-11-26"])("rejects the impossible date %s", (date) => {
    expect(() => parseApplication(formData({ date }))).toThrow(/today’s date/);
  });
});

describe("isSigningDate", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");

  it.each(["2026-11-23", "2026-11-24", "2025-11-23"])("accepts %s", (date) => {
    expect(isSigningDate(date, now)).toBe(true);
  });

  it("accepts a leap day only in a leap year", () => {
    const leapYear = Date.parse("2028-03-01T12:00:00Z");
    expect(isSigningDate("2028-02-29", leapYear)).toBe(true);
    expect(isSigningDate("2027-02-29", leapYear)).toBe(false);
  });

  it.each([undefined, null, 20261123, "", "2026-11-25", "2025-11-21", "+02026-11-23"])("rejects %s", (date) => {
    expect(isSigningDate(date, now)).toBe(false);
  });
});
