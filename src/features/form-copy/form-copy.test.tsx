// @vitest-environment jsdom
// Editable wording for the built-in forms (migration 0011): the manifest matches the pages and the pages show the
// replacements. Server rules are in copy.server.test.ts (no node:sqlite in a jsdom file).
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationForm } from "@/features/applications/ApplicationForm";
import { ContactForm } from "@/features/contact/ContactForm";
import { AREAS } from "@/features/applications/schema";
import { FormCopyProvider } from "./FormCopy";
import { COPY_FIELDS, COPY_FORMS, type CopyForm } from "./manifest";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

/** Where each form's wording lives in code. A manifest text must appear in one of these, exactly. */
const SOURCES: Record<CopyForm, string[]> = {
  application: ["src/features/applications/ApplicationForm.tsx", "src/features/applications/schema.ts", "src/routes/join.tsx"],
  review: ["src/features/member-links/ReviewForm.tsx", "src/features/member-links/schema.ts", "src/routes/review.tsx"],
  contact: ["src/features/contact/ContactForm.tsx", "src/routes/contact.tsx"],
  partnership: ["src/features/contact/PartnershipForm.tsx", "src/routes/partnerships.tsx"],
};

describe("manifest", () => {
  for (const form of COPY_FORMS) {
    it(`${form}: every text is on its page, exactly once in the list`, () => {
      const code = SOURCES[form].map((file) => readFileSync(file, "utf8")).join("\n");
      const texts = COPY_FIELDS[form].map((f) => f.text);
      expect(texts.filter((t) => !code.includes(t))).toEqual([]);
      expect(new Set(texts).size).toBe(texts.length);
      expect(texts.every((t) => t.length > 0 && t.length <= 400)).toBe(true);
    });
  }
});

afterEach(cleanup);

describe("on the pages", () => {
  it("states no headshot cost, on the application's headshot section or the account card", () => {
    const { container } = render(<FormCopyProvider copy={{}}><ApplicationForm area={AREAS[0]!} submit={async () => undefined} /></FormCopyProvider>);
    fireEvent.click(container.querySelector('input[name="directory"][value="yes"]')!);
    expect(screen.getByLabelText(/I authorize photography/)).toBeTruthy();
    const cost = /\bpaid\b|\bpayment\b|\bfees?\b|\bprices?\b|included with/i;
    expect(container.textContent).not.toMatch(cost);
    expect(readFileSync("src/features/account/HeadshotBooking.tsx", "utf8")).not.toMatch(cost);
  });

  it("the application shows replaced section and field wording, and the defaults elsewhere", () => {
    render(
      <FormCopyProvider copy={{ "Start with you.": "Begin here.", "Full name": "Your full name", "Submit application": "Send it in" }}>
        <ApplicationForm area={AREAS[0]!} submit={async () => undefined} />
      </FormCopyProvider>,
    );
    expect(screen.getByRole("heading", { name: "Begin here." })).toBeTruthy();
    expect(screen.getByLabelText("Your full name")).toBeTruthy();
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.getByRole("button", { name: /Send it in/ })).toBeTruthy();
    // Untouched wording, and the consent statements, stay as written.
    expect(screen.getByLabelText("Preferred name", { exact: false })).toBeTruthy();
    expect(screen.getByLabelText(/By submitting, I confirm that I have read/)).toBeTruthy();
  });

  it("without a provider (or any override) the page reads exactly as written in code", () => {
    render(<ApplicationForm area={AREAS[0]!} submit={async () => undefined} />);
    expect(screen.getByRole("heading", { name: "Start with you." })).toBeTruthy();
    expect(screen.getByLabelText("Full name")).toBeTruthy();
  });

  it("the contact form shows replaced labels and button", () => {
    render(
      <FormCopyProvider copy={{ "Your name": "Who are you?", "Send message": "Send it" }}>
        <ContactForm send={async () => undefined} />
      </FormCopyProvider>,
    );
    expect(screen.getByLabelText("Who are you?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send it/ })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
});
