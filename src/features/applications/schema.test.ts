import { describe, expect, it } from "vitest";
import { GUIDELINES, parseApplication } from "./schema";

type Entries = Record<string, string | string[]>;

/** The smallest application the form accepts, plus empty optional text inputs as a browser would send them. */
const minimum: Entries = {
  "full-name": "  Rosa Diaz ",
  "preferred-name": "",
  pronouns: " ",
  email: " rosa@x.test ",
  phone: "718-555-0100",
  neighborhood: "Astoria",
  connection: ["I live here", "I own a business here"],
  business: "",
  role: "Baker",
  story: "I bake bread for the block.",
  industry: ["Food and hospitality"],
  "community-goals": ["Referrals", "Clients"],
  "ideal-referral": "Cafés that need a wholesale baker.",
  "member-support": ["Give referrals"],
  whatsapp: "no",
  spotlight: "no",
  directory: "no",
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

describe("parseApplication", () => {
  it("parses a filled form into the typed shape, trimming strings and omitting empty optionals", () => {
    expect(parseApplication(formData())).toEqual({
      email: "rosa@x.test",
      fullName: "Rosa Diaz",
      neighborhood: "Astoria",
      answers: {
        phone: "718-555-0100",
        basedIn: "Astoria",
        connection: ["I live here", "I own a business here"],
        role: "Baker",
        story: "I bake bread for the block.",
        industry: ["Food and hospitality"],
        communityGoals: ["Referrals", "Clients"],
        idealReferral: "Cafés that need a wholesale baker.",
        memberSupport: ["Give referrals"],
        whatsapp: { join: false },
        spotlight: { choice: "no" },
        directory: { choice: "no" },
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

  it("reads consent checkboxes as booleans in the sections that ask for them", () => {
    const { answers } = parseApplication(formData({
      whatsapp: "yes", "whatsapp-number": "718-555-0101", "whatsapp-visibility": "on", "whatsapp-conduct": "on",
      spotlight: "yes", "spotlight-focus": "My sourdough", "spotlight-consent": "on",
      directory: "yes", "public-fields": ["Full name", "Website"], "directory-bio": "Rosa bakes.", services: "Bread",
      "directory-consent": "on", "headshot-contact": "Email",
      "headshot-paid-session": "on", "headshot-official-only": "on", "headshot-photo-consent": "on",
      "headshot-extra-fees": "on", "headshot-placement": "on",
    }));
    expect(answers.whatsapp).toEqual({ join: true, number: "718-555-0101", numberVisible: true, keepRespectful: true });
    expect(answers.spotlight).toEqual({ choice: "yes", focus: "My sourdough", publicationConsent: true });
    expect(answers.directory).toEqual({
      choice: "yes", publicFields: ["Full name", "Website"], bio: "Rosa bakes.", services: "Bread", publicationConsent: true,
      headshot: { contact: "Email", paidSession: true, officialOnly: true, photoConsent: true, extraFees: true, placementNotGuaranteed: true },
    });
    expect(answers.newsletter).toEqual({ subscribe: true, emailConsent: true });
    expect(parseApplication(formData({ newsletter: "no" }, ["newsletter-consent"])).answers.newsletter).toEqual({ subscribe: false });
  });

  it.each(["Other", "Another Queens neighborhood"])("resolves %s to the typed location", (choice) => {
    const parsed = parseApplication(formData({ neighborhood: choice, "other-location": "  Ridgewood " }));
    expect(parsed.neighborhood).toBe("Ridgewood");
    expect(parsed.answers.basedIn).toBe(choice);
  });

  it("throws a readable error when the typed location is missing", () => {
    expect(() => parseApplication(formData({ neighborhood: "Other", "other-location": " " }))).toThrow(/where you are based/i);
  });

  it.each([
    ["connection", /connection to Western Queens/i],
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
});
