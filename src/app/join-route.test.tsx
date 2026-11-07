// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/join";
import { GUIDELINES } from "@/features/applications/schema";

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
});

type Result = { data: unknown; error: unknown };
function deferred() {
  let resolve!: (r: Result) => void;
  const promise = new Promise<Result>((r) => (resolve = r));
  return { promise: promise as never, resolve };
}

const signedOut: Result = { data: { session: null }, error: null };
const ok: Result = { data: null, error: null };
const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: RegExp, value: string) => fireEvent.change(field(label), { target: { value } });
const check = (label: string) => fireEvent.click(screen.getByLabelText(label));
const submitButton = () => screen.getByRole("button", { name: /submit application/i }) as HTMLButtonElement;
const inserts = () => fake.calls.filter(([name]) => name === "insert");
const thanks = () => screen.queryByRole("heading", { name: /thank you for introducing yourself/i });
// Mutations await getSupabase() and the session before inserting; let that settle.
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

/** Fills only the fields the form requires (the default radio answers need nothing else but the newsletter consent). */
function fillMinimum() {
  type(/^full name$/i, "Rosa Diaz");
  type(/^email address$/i, "rosa@x.test");
  type(/^phone number$/i, "718-555-0100");
  fireEvent.change(screen.getByLabelText(/where are you based/i), { target: { value: "Astoria" } });
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
  fireEvent.click(screen.getByLabelText(/by submitting, i confirm/i));
}

const renderSignedOut = () => renderWithQueries(<Page />, [[["applicant"], null]]);

// Filling ~30 fields through label queries on this long form takes ~4–5 s under jsdom, so allow headroom.
describe("/join", { timeout: 20_000 }, () => {
  it("shows the success state only after the insert resolves, with no reset on the live route", async () => {
    const insert = deferred();
    fake.results = [signedOut, insert.promise];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());
    await settle();

    expect(inserts()).toEqual([["insert", expect.objectContaining({ full_name: "Rosa Diaz", email: "rosa@x.test", neighborhood: "Astoria", user_id: null })]]);
    expect(thanks()).toBeNull();
    // aria-disabled, not disabled, so focus stays on the button while sending.
    expect(submitButton().getAttribute("aria-disabled")).toBe("true");
    expect(submitButton().disabled).toBe(false);

    await act(async () => insert.resolve(ok));
    const status = await screen.findByRole("status");
    expect(within(status).getByRole("heading", { name: /thank you for introducing yourself/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /review another application/i })).toBeNull();
  });

  it("an insert error shows an alert, keeps the form and its values, and Retry resubmits", async () => {
    fake.results = [signedOut, { data: null, error: { message: "violates check constraint" } }, signedOut, ok];
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
    expect(await screen.findByRole("heading", { name: /thank you for introducing yourself/i })).toBeTruthy();
    const [first, second] = inserts();
    expect(second).toEqual(first);
  });

  it("Retry re-reads the form, so an edit made after the failure is what gets sent", async () => {
    fake.results = [signedOut, { data: null, error: { message: "network" } }, signedOut, ok];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    type(/professional title or role/i, "Pastry chef");
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    expect(await screen.findByRole("heading", { name: /thank you for introducing yourself/i })).toBeTruthy();
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
    fake.results = [signedOut, insert.promise, signedOut, ok];
    renderSignedOut();
    fillMinimum();
    fireEvent.click(submitButton());
    await settle();
    fireEvent.click(submitButton());
    fireEvent.submit(submitButton().form!);
    await settle();
    expect(inserts()).toHaveLength(1);
    await act(async () => insert.resolve(ok));
    expect(await screen.findByRole("heading", { name: /thank you for introducing yourself/i })).toBeTruthy();
    expect(inserts()).toHaveLength(1);
  });

  it("prefills name and email for a signed-in applicant", async () => {
    fake.results = [{ data: { session: { user: { id: "u1", email: "rosa@x.test", user_metadata: { full_name: "Rosa Diaz" } } } }, error: null }];
    renderWithQueries(<Page />);
    await waitFor(() => expect(field(/^email address$/i).value).toBe("rosa@x.test"));
    expect(field(/^full name$/i).value).toBe("Rosa Diaz");
  });

  it("never overwrites what the applicant already typed", async () => {
    const session = deferred();
    fake.results = [session.promise];
    renderWithQueries(<Page />);
    type(/^full name$/i, "Rosie");
    await act(async () => session.resolve({ data: { session: { user: { id: "u1", email: "rosa@x.test", user_metadata: { full_name: "Rosa Diaz" } } } }, error: null }));
    await waitFor(() => expect(field(/^email address$/i).value).toBe("rosa@x.test"));
    expect(field(/^full name$/i).value).toBe("Rosie");
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
