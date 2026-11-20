import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COPY_FORMS } from "@/features/form-copy/manifest";
import { BUILT_IN_COPIES } from "./built-in-copies";
import { checkQuestions } from "./schema";

/** Where each built-in form's labels and choices are written. */
const SOURCES = {
  application: ["src/features/applications/ApplicationForm.tsx", "src/features/applications/schema.ts"],
  review: ["src/features/member-links/ReviewForm.tsx", "src/features/member-links/schema.ts"],
  contact: ["src/features/contact/ContactForm.tsx", "src/features/contact/schema.ts"],
  partnership: ["src/features/contact/PartnershipForm.tsx", "src/features/contact/partnership.ts"],
};

describe("built-in form copies", () => {
  it.each(COPY_FORMS)("%s is a valid custom form whose labels and choices are the page's own", (kind) => {
    const template = BUILT_IN_COPIES[kind];
    expect(checkQuestions(template.questions)).toEqual(template.questions);
    const source = SOURCES[kind].map((f) => readFileSync(f, "utf8")).join("\n");
    const texts = template.questions.flatMap((q) => [q.label, ...(q.choices ?? []).map((c) => c.label)]);
    expect(texts.filter((text) => !source.includes(text))).toEqual([]);
  });

  it("leaves out consents, guidelines, the signature and the newsletter opt-in", () => {
    const keys = BUILT_IN_COPIES.application.questions.map((q) => q.key);
    for (const key of ["newsletter", "signature", "date", "guidelines", "final_confirmation", "directory_consent"]) expect(keys).not.toContain(key);
    expect(BUILT_IN_COPIES.contact.questions.map((q) => q.key)).not.toContain("consent");
  });
});
