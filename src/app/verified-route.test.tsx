// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

const auth = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/app/auth-client", () => ({ getAuthClient: async () => auth }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/verified";

const Page = Route.options.component as React.ComponentType;
const search = vi.spyOn(Route, "useSearch");
const validate = Route.options.validateSearch as (s: Record<string, unknown>) => unknown;

beforeEach(() => search.mockReturnValue({}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function resend(email = "rosa@x.test") {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /send a new link/i }));
}

describe("/verified", () => {
  it("reads Better Auth's ?error= and nothing else", () => {
    expect(validate({ error: "TOKEN_EXPIRED" })).toEqual({ error: "TOKEN_EXPIRED" });
    expect(validate({ error: "" })).toEqual({});
    expect(validate({ error: 1, token: "x" })).toEqual({});
  });

  it("a link that worked: confirmed, one h1, on to /account (or the application), in the site chrome", () => {
    const { container } = renderWithQueries(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "You’re confirmed, neighbor." })).toBeTruthy();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /finish my profile/i }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("link", { name: /haven’t applied yet/i }).getAttribute("href")).toBe("/join");
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.getAllByRole("main").map((m) => m.id)).toEqual(["main"]);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });

  it.each(["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"])("a failed link (%s) offers a fresh one, not the confirmation", (error) => {
    search.mockReturnValue({ error });
    renderWithQueries(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "This link has run its course." })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /finish my profile/i })).toBeNull();
    expect(screen.getByRole("link", { name: /already confirmed\? sign in/i }).getAttribute("href")).toBe("/auth");
  });

  // Success and a rate limit read the same, so the form can't be used to probe for accounts.
  it.each([
    ["sent", { data: { status: true }, error: null }],
    ["rate-limited", { data: null, error: { message: "Too many requests", status: 429 } }],
  ])("resend %s: the same neutral wording, back to /verified", async (_label, result) => {
    search.mockReturnValue({ error: "TOKEN_EXPIRED" });
    auth.sendVerificationEmail.mockResolvedValue(result);
    renderWithQueries(<Page />);
    await resend();
    expect((await screen.findByRole("status")).textContent).toBe("If this email is new to us, a confirmation link is on its way.");
    expect(auth.sendVerificationEmail).toHaveBeenCalledWith({ email: "rosa@x.test", callbackURL: "/verified" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("any other resend failure reads generic, never the server's words", async () => {
    search.mockReturnValue({ error: "INVALID_TOKEN" });
    auth.sendVerificationEmail.mockResolvedValue({ data: null, error: { message: "Email mismatch", code: "EMAIL_MISMATCH", status: 400 } });
    renderWithQueries(<Page />);
    await resend();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t send a link right now/i);
    expect(alert.textContent).not.toContain("mismatch");
    expect(screen.getByLabelText(/email/i).getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
