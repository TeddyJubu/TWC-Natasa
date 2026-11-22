// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/applications/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs, useNavigate: () => navigate }));

import { Route } from "@/routes/join";
import { GUIDELINES } from "@/features/applications/schema";

const Page = Route.options.component as React.ComponentType;
const openState = { kind: "application" as const, open: true, closed: null as string | null };
beforeEach(() => {
  vi.spyOn(Route, "useLoaderData").mockReturnValue(openState as never);
  vi.spyOn(Route, "useSearch").mockReturnValue({ area: "north-brooklyn" } as never);
});
afterEach(() => {
  cleanup();
  fake.reset();
  navigate.mockReset();
});

function deferred() {
  let resolve!: (r: unknown) => void;
  const promise = new Promise<unknown>((r) => (resolve = r));
  return { promise, resolve };
}

const ok = null;
/**
 * The control a `<label>` names, like `getByLabelText` (exact string or regex on the label's text, and
 * more than one match is an error) but in one pass over the labels. `getByLabelText` costs ~0.4 s per call
 * on this ~110-label form under jsdom, so filling it took ~10 s idle and over 20 s under load, and a
 * timed-out test left an act() open that blanked the renders of the tests after it.
 * Controls named only by aria-label/aria-labelledby fall back to `getByLabelText`.
 */
function byLabel(label: RegExp | string): HTMLElement {
  const matches = [...document.querySelectorAll("label")].filter((l) => {
    const text = (l.textContent ?? "").replace(/\s+/g, " ").trim();
    return l.control && (typeof label === "string" ? text === label : label.test(text));
  });
  if (matches.length > 1) throw new Error(`More than one control is labelled ${label}`);
  return matches[0]?.control ?? screen.getByLabelText(label);
}
const field = (label: RegExp) => byLabel(label) as HTMLInputElement;
const type = (label: RegExp, value: string) => fireEvent.change(field(label), { target: { value } });
const check = (label: string) => fireEvent.click(byLabel(label));
const submitButton = () => screen.getByRole("button", { name: /submit application/i }) as HTMLButtonElement;
const inserts = () => fake.calls.filter(([name]) => name === "/api/applications");
/** The live /join moves on to its own thank-you page once the application is in. */
const thanks = () => (navigate.mock.calls.length ? navigate : null);
const sentToThanks = () => waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/join/thanks" }));
// Mutations call their server function asynchronously; let that settle.
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

/** Fills only the fields the form requires (the default radio answers need nothing else but the newsletter consent). */
function fillMinimum() {
  type(/^full name$/i, "Rosa Diaz");
  type(/^email address$/i, "rosa@x.test");
  type(/^phone number$/i, "718-555-0100");
  fireEvent.change(byLabel(/where are you based/i), { target: { value: "Williamsburg" } });
  check("I live here");
  type(/professional title or role/i, "Baker");
  type(/tell us about yourself and your work/i, "I bake bread for the block.");
  check("Food and hospitality");
  check("Referrals");
  type(/your ideal referral or connection/i, "Cafés that need a wholesale baker.");
  check("Give referrals");
  check("I consent to receive collective email and understand I can unsubscribe at any time.");
  GUIDELINES.forEach(check);
  type(/electronic signature/i, "Rosa Diaz");
  type(/^date$/i, "2026-11-08");
  fireEvent.click(byLabel(/by submitting, i confirm/i));
}

const renderSignedOut = () => renderWithQueries(<Page />, [[["applicant"], null]]);

describe("/join", () => {
  it("moves on to /join/thanks only after the insert resolves", async () => {
    const insert = deferred();
    fake.results = [insert.promise];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());
    await settle();

    expect(inserts()).toEqual([["/api/applications", expect.objectContaining({ fullName: "Rosa Diaz", email: "rosa@x.test", neighborhood: "Williamsburg" })]]);
    expect(thanks()).toBeNull();
    // aria-disabled, not disabled, so focus stays on the button while sending.
    expect(submitButton().getAttribute("aria-disabled")).toBe("true");
    expect(submitButton().disabled).toBe(false);

    await act(async () => insert.resolve(ok));
    await sentToThanks();
    // Pre-launch an applicant isn't sent on to make a login.
    expect(screen.queryByRole("link", { name: /create your login/i })).toBeNull();
  });

  it("the thank-you page says the application is in and links nowhere", async () => {
    const { Route: Thanks } = await import("@/routes/join_.thanks");
    const ThanksPage = Thanks.options.component as React.ComponentType;
    renderWithQueries(<ThanksPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Thank you for applying.");
    expect(screen.getByText("We’ve received your application and we’ll be in touch.")).toBeTruthy();
    expect(screen.queryAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#main"]);
  });

  it("an insert error shows an alert, keeps the form and its values, and Retry resubmits", async () => {
    fake.results = [new Error("Some details aren’t valid."), ok];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t send your application/i);
    expect(thanks()).toBeNull();
    expect(field(/^full name$/i).value).toBe("Rosa Diaz");
    expect(field(/^email address$/i).value).toBe("rosa@x.test");
    expect(submitButton().disabled).toBe(false);

    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    await sentToThanks();
    const [first, second] = inserts();
    expect(second).toEqual(first);
  });

  it("Retry re-reads the form, so an edit made after the failure is what gets sent", async () => {
    fake.results = [new Error("network"), ok];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    type(/professional title or role/i, "Pastry chef");
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    await sentToThanks();
    const [first, second] = inserts() as [string, { answers: { role: string } }][];
    expect(first[1].answers.role).toBe("Baker");
    expect(second[1].answers.role).toBe("Pastry chef");
  });

  it("a parser error is announced in a focused alert naming the field, and clears when the form changes", async () => {
    renderSignedOut();
    fillMinimum();
    type(/^phone number$/i, "   "); // passes native `required`, fails the parser
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/phone number/i);
    expect(document.activeElement).toBe(alert);
    expect(inserts()).toEqual([]);
    type(/^phone number$/i, "718-555-0100");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a second submit while the first is pending is ignored", async () => {
    const insert = deferred();
    fake.results = [insert.promise, ok];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());
    await settle();
    fireEvent.click(submitButton());
    fireEvent.submit(submitButton().form!);
    await settle();
    expect(inserts()).toHaveLength(1);
    await act(async () => insert.resolve(ok));
    await sentToThanks();
    expect(inserts()).toHaveLength(1);
  });

  it("prefills name and email for a signed-in applicant", async () => {
    fake.results = [{ email: "rosa@x.test", fullName: "Rosa Diaz" }];
    renderWithQueries(<Page />);
    await waitFor(() => expect(field(/^email address$/i).value).toBe("rosa@x.test"));
    expect(field(/^full name$/i).value).toBe("Rosa Diaz");
  });

  it("never overwrites what the applicant already typed", async () => {
    const session = deferred();
    fake.results = [session.promise];
    renderWithQueries(<Page />);
    type(/^full name$/i, "Rosie");
    await act(async () => session.resolve({ email: "rosa@x.test", fullName: "Rosa Diaz" }));
    await waitFor(() => expect(field(/^email address$/i).value).toBe("rosa@x.test"));
    expect(field(/^full name$/i).value).toBe("Rosie");
  });

  it("a filled honeypot gets the normal thank-you and never inserts", async () => {
    renderSignedOut();
    fillMinimum();
    const trap = document.querySelector<HTMLInputElement>('input[name="fax-number"]')!;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.autocomplete).toBe("off");
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
    fireEvent.change(trap, { target: { value: "555-0199" } });
    fireEvent.click(submitButton());
    await sentToThanks();
    expect(fake.calls).toEqual([]);
  });

  it("an empty honeypot inserts as usual", async () => {
    fake.results = [ok];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());
    await sentToThanks();
    expect(inserts()).toHaveLength(1);
    expect(JSON.stringify(inserts())).not.toMatch(/fax-number/);
  });

  it("a required group left empty blocks submit with its error and never inserts", async () => {
    renderSignedOut();
    fillMinimum();
    check("Give referrals"); // unchecks the only member-support answer
    fireEvent.click(submitButton());
    await settle();

    const group = screen.getByRole("group", { name: /how would you like to support other members/i });
    expect(within(group).getByRole("alert").textContent).toMatch(/choose at least one option/i);
    expect(inserts()).toEqual([]);
    expect(fake.calls).toEqual([]);
  });
});

describe("/join neighborhoods", () => {
  it("takes a typed neighborhood, and asks about North Brooklyn", () => {
    renderSignedOut();
    const input = byLabel(/where are you based/i) as HTMLInputElement;
    expect([input.tagName, input.required, input.maxLength]).toEqual(["INPUT", true, 60]);
    expect(screen.getByRole("group", { name: /connection to North Brooklyn/i })).toBeTruthy();
    expect(screen.queryByRole("group", { name: /connection to Queens/i })).toBeNull();
  });
});

describe("plain /join", () => {
  it("asks for the area first: both areas, no form and no assumed answer", () => {
    vi.spyOn(Route, "useSearch").mockReturnValue({} as never);
    renderSignedOut();
    expect(screen.getByRole("heading", { name: "Which area is yours?", level: 2 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^North Brooklyn/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Queens/ })).toBeTruthy();
    expect(document.querySelector("input[name=area]")).toBeNull();
    expect(screen.queryByRole("button", { name: /submit application/i })).toBeNull();
    expectNoSkippedHeadings();
  });

  it("names the chosen area above the form and offers the other", () => {
    renderSignedOut();
    expect(screen.getByText("North Brooklyn").tagName).toBe("B");
    expect(screen.getByRole("link", { name: "Switch to Queens" })).toBeTruthy();
  });
});

describe("/join?area=queens", () => {
  it("takes a typed neighborhood, asks about Queens and sends its area", () => {
    vi.spyOn(Route, "useSearch").mockReturnValue({ area: "queens" } as never);
    renderSignedOut();
    expect(byLabel(/where are you based/i).tagName).toBe("INPUT");
    expect(screen.getByRole("group", { name: /connection to Queens/i })).toBeTruthy();
    expect((document.querySelector("input[name=area]") as HTMLInputElement).value).toBe("queens");
  });

  it("drops an unknown area from the address", () => {
    const validate = Route.options.validateSearch as (raw: Record<string, unknown>) => unknown;
    expect(validate({ area: "queens" })).toEqual({ area: "queens" });
    expect(validate({ area: "mars" })).toEqual({});
  });
});

describe("/join structure", () => {
  it("never skips a heading level: h1, then h2 sections", () => {
    renderSignedOut();
    expectNoSkippedHeadings();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Start with you.", level: 2 })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Start with you." })).toBeTruthy();
  });

  it("shows closed words instead of the form when applications are closed", () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({
      kind: "application", open: false, closed: "Paused until spring.",
    } as never);
    renderSignedOut();
    expect(screen.getByRole("heading", { name: "Applications are closed" })).toBeTruthy();
    expect(screen.getByText("Paused until spring.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit application/i })).toBeNull();
  });
});
