// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: { signInWithOAuth: vi.fn() } } }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/auth";

const Page = Route.options.component as React.ComponentType;
const search = vi.spyOn(Route, "useSearch");

beforeEach(() => {
  search.mockReturnValue({});
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe() {} } } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("/auth", () => {
  it.each(["Invalid login credentials", "Email not confirmed"])(
    "uses one generic sign-in failure message (%s)",
    async (raw) => {
      auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: raw } });
      renderWithQueries(<Page />);
      fill(/email/i, "a@x.test");
      fill(/password/i, "wrongpass");
      submit(/^sign in$/i);
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/email or password didn’t match/i);
      expect(alert.textContent).not.toContain(raw);
    },
  );

  it("clears the error when switching to forgot-password mode", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    fill(/password/i, "wrongpass");
    submit(/^sign in$/i);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the notice when going back to sign in", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    search.mockReturnValue({ mode: "forgot" });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    submit(/send reset link/i);
    await screen.findByText(/reset link is on its way/i);
    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(screen.queryByText(/reset link is on its way/i)).toBeNull();
  });

  it("forgot-password: a rate limit reads like success, other errors read generic", async () => {
    search.mockReturnValue({ mode: "forgot" });
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: "For security purposes, you can only request this after 42 seconds.", code: "over_email_send_rate_limit" } });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    submit(/send reset link/i);
    expect((await screen.findByRole("status")).textContent).toMatch(/reset link is on its way/i);
    cleanup();
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: "network down", code: "unexpected_failure" } });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    submit(/send reset link/i);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t send a link right now/i);
    expect(alert.textContent).not.toContain("network down");
  });

  it("opens in the mode named in the URL", () => {
    search.mockReturnValue({ mode: "forgot" });
    renderWithQueries(<Page />);
    expect(screen.getByRole("heading", { name: "Reset Your Password" })).toBeTruthy();
  });

  describe("sign-up", () => {
    const signUp = async () => {
      fireEvent.click(screen.getByRole("tab", { name: /create account/i }));
      fill(/full name/i, "Rosa");
      fill(/email/i, "rosa@x.test");
      fill(/password/i, "longenough");
      submit(/^create account$/i);
    };

    // New and existing emails must read exactly the same, so sign-up can't be used to probe for accounts.
    const neutral = async () => (await screen.findByRole("status")).textContent;

    it.each([
      ["a new email", { data: { user: { identities: [{ id: "i1" }] } }, error: null }],
      ["an existing email (no identities)", { data: { user: { identities: [] } }, error: null }],
      ["an 'already registered' error code", { data: { user: null }, error: { message: "x", code: "user_already_exists" } }],
      ["an 'already registered' message", { data: { user: null }, error: { message: "User already registered" } }],
    ])("answers %s with the same neutral notice and no error", async (_label, result) => {
      auth.signUp.mockResolvedValue(result);
      renderWithQueries(<Page />);
      await signUp();
      expect(await neutral()).toMatch(/check your inbox.*already have an account/i);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows the password rule for a weak password, and generic copy for anything else", async () => {
      auth.signUp.mockResolvedValue({ data: { user: null }, error: { message: "Password should contain a number", code: "weak_password" } });
      renderWithQueries(<Page />);
      await signUp();
      expect((await screen.findByRole("alert")).textContent).toBe("Password should contain a number");
      cleanup();
      auth.signUp.mockResolvedValue({ data: { user: null }, error: { message: "Database error saving new user", code: "unexpected_failure" } });
      renderWithQueries(<Page />);
      await signUp();
      expect((await screen.findByRole("alert")).textContent).toMatch(/couldn’t create your account/i);
    });
  });
});
