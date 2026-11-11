// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
  requestPasswordReset: vi.fn(),
}));
const emitted = vi.hoisted(() => [] as string[]);
vi.mock("@/app/auth-client", () => ({ getAuthClient: async () => auth }));
vi.mock("@/app/auth-events", async (orig) => ({ ...(await orig<object>()), emitAuthEvent: (e: string) => emitted.push(e) }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/auth";

const Page = Route.options.component as React.ComponentType;
const search = vi.spyOn(Route, "useSearch");

beforeEach(() => {
  search.mockReturnValue({});
  auth.getSession.mockResolvedValue({ data: null, error: null });
  emitted.length = 0;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("/auth Google sign-in", () => {
  const googleButton = () => screen.queryByRole("button", { name: /continue with google/i });

  it.each([undefined, "", "false", "1", "TRUE"])("is hidden unless VITE_GOOGLE_AUTH is exactly \"true\" (%s)", (value) => {
    vi.stubEnv("VITE_GOOGLE_AUTH", value as string);
    renderWithQueries(<Page />);
    expect(googleButton()).toBeNull();
    expect(screen.queryByText(/or with email/i)).toBeNull();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it("when on, signs in with Google through Better Auth, landing on /account (errors back on /auth)", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH", "true");
    auth.signIn.social.mockResolvedValue({ data: {}, error: null });
    renderWithQueries(<Page />);
    fireEvent.click(googleButton()!);
    await vi.waitFor(() => expect(auth.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/account", errorCallbackURL: "/auth" }));
  });

  it("when on, shows an OAuth error as an alert", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH", "true");
    auth.signIn.social.mockResolvedValue({ data: null, error: { message: "provider is not enabled", status: 404 } });
    renderWithQueries(<Page />);
    fireEvent.click(googleButton()!);
    expect((await screen.findByRole("alert")).textContent).toMatch(/google sign-in didn’t work/i);
  });
});

describe("/auth", () => {
  it.each(["Invalid email or password", "Email not verified"])(
    "uses one generic sign-in failure message (%s)",
    async (raw) => {
      auth.signIn.email.mockResolvedValue({ data: null, error: { message: raw, status: 401 } });
      renderWithQueries(<Page />);
      fill(/email/i, "a@x.test");
      fill(/password/i, "wrongpass");
      submit(/^sign in$/i);
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/email or password didn’t match/i);
      expect(alert.textContent).not.toContain(raw);
    },
  );

  it("signs in, announces it to the app and opens /account", async () => {
    auth.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    fill(/password/i, "rightpass");
    submit(/^sign in$/i);
    await vi.waitFor(() => expect(emitted).toEqual(["SIGNED_IN"]));
    expect(auth.signIn.email).toHaveBeenCalledWith({ email: "a@x.test", password: "rightpass" });
  });

  it("clears the error when switching to forgot-password mode", async () => {
    auth.signIn.email.mockResolvedValue({ data: null, error: { message: "Invalid email or password", status: 401 } });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    fill(/password/i, "wrongpass");
    submit(/^sign in$/i);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the notice when going back to sign in", async () => {
    auth.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
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
    auth.requestPasswordReset.mockResolvedValue({ data: null, error: { message: "Too many requests", status: 429 } });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    submit(/send reset link/i);
    expect((await screen.findByRole("status")).textContent).toMatch(/reset link is on its way/i);
    cleanup();
    auth.requestPasswordReset.mockResolvedValue({ data: null, error: { message: "network down", status: 500 } });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    submit(/send reset link/i);
    expect(auth.requestPasswordReset).toHaveBeenCalledWith({ email: "a@x.test", redirectTo: "/reset-password" });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t send a link right now/i);
    expect(alert.textContent).not.toContain("network down");
  });

  it("switches sign-in / create-account with ARIA tabs: arrows move and select, one tab stop, inside the site chrome", () => {
    renderWithQueries(<Page />);
    const list = screen.getByRole("tablist", { name: /sign in or create an account/i });
    const [signIn, create] = within(list).getAllByRole("tab");
    const panel = screen.getByRole("tabpanel");
    expect([signIn.getAttribute("aria-selected"), create.getAttribute("aria-selected")]).toEqual(["true", "false"]);
    expect([signIn.tabIndex, create.tabIndex]).toEqual([0, -1]);
    expect(signIn.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(signIn.id);

    signIn.focus();
    fireEvent.keyDown(signIn, { key: "ArrowRight" });
    expect(document.activeElement).toBe(create);
    expect([signIn.getAttribute("aria-selected"), create.getAttribute("aria-selected")]).toEqual(["false", "true"]);
    expect([signIn.tabIndex, create.tabIndex]).toEqual([-1, 0]);
    expect(screen.getByRole("heading", { level: 1, name: "Open your member account" })).toBeTruthy();
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(create.id);
    fireEvent.keyDown(create, { key: "ArrowRight" }); // wraps
    expect(document.activeElement).toBe(signIn);
    fireEvent.keyDown(signIn, { key: "End" });
    expect(document.activeElement).toBe(create);
    fireEvent.keyDown(create, { key: "Home" });
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back, neighbor." })).toBeTruthy();
    fireEvent.click(create);
    expect(create.getAttribute("aria-selected")).toBe("true");

    const mains = screen.getAllByRole("main");
    expect(mains.map((m) => m.id)).toEqual(["main"]);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("opens in the mode named in the URL: ?mode=forgot (no tabs) and ?mode=signup", () => {
    search.mockReturnValue({ mode: "forgot" });
    renderWithQueries(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "Reset your password" })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    cleanup();
    search.mockReturnValue({ mode: "signup" });
    renderWithQueries(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "Open your member account" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Create account" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText(/full name/i)).toBeTruthy();
  });

  it("validates the mode search param", () => {
    const validate = Route.options.validateSearch as (s: Record<string, unknown>) => unknown;
    expect(validate({ mode: "signup" })).toEqual({ mode: "signup" });
    expect(validate({ mode: "admin" })).toEqual({});
  });

  it("ties a sign-in error to the fields it is about", async () => {
    auth.signIn.email.mockResolvedValue({ data: null, error: { message: "Invalid email or password", status: 401 } });
    renderWithQueries(<Page />);
    fill(/email/i, "a@x.test");
    fill(/password/i, "wrongpass");
    submit(/^sign in$/i);
    const alert = await screen.findByRole("alert");
    expect(screen.getByLabelText(/email/i).getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.getByLabelText(/password/i).getAttribute("aria-invalid")).toBe("true");
  });

  describe("sign-up", () => {
    const signUp = async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Create account" }));
      fill(/full name/i, "Rosa");
      fill(/email/i, "rosa@x.test");
      fill(/password/i, "longenough");
      submit(/^create account$/i);
    };

    // New and existing emails must read exactly the same, so sign-up can't be used to probe for accounts.
    const neutral = async () => (await screen.findByRole("status")).textContent;

    it.each([
      ["a new email", { data: { token: null, user: { id: "u1" } }, error: null }],
      ["an 'already exists' error code", { data: null, error: { message: "x", code: "USER_ALREADY_EXISTS", status: 422 } }],
      ["the 'use another email' variant", { data: null, error: { message: "x", code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 } }],
    ])("answers %s with the same neutral notice and no error", async (_label, result) => {
      auth.signUp.email.mockResolvedValue(result);
      renderWithQueries(<Page />);
      await signUp();
      expect(auth.signUp.email).toHaveBeenCalledWith({ email: "rosa@x.test", password: "longenough", name: "Rosa", callbackURL: "/verified" });
      expect(await neutral()).toMatch(/check your inbox.*already have an account/i);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows the password rule for a weak password, and generic copy for anything else", async () => {
      auth.signUp.email.mockResolvedValue({ data: null, error: { message: "Password too short", code: "PASSWORD_TOO_SHORT", status: 400 } });
      renderWithQueries(<Page />);
      await signUp();
      expect((await screen.findByRole("alert")).textContent).toBe("Password too short");
      cleanup();
      auth.signUp.email.mockResolvedValue({ data: null, error: { message: "Failed to create user", code: "FAILED_TO_CREATE_USER", status: 500 } });
      renderWithQueries(<Page />);
      await signUp();
      expect((await screen.findByRole("alert")).textContent).toMatch(/couldn’t create your account/i);
    });
  });
});

describe("/auth focus", () => {
  it("moves focus to the Email field when Forgot password? and Back to sign in replace the form", async () => {
    renderWithQueries(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /forgot password\?/i }));
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/email/i)));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/reset your password/i);
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/email/i)));
  });
});

describe("/auth after a password reset", () => {
  it("?reset=done shows that the password is changed, as a status notice above Sign in", () => {
    search.mockReturnValue({ reset: "done" });
    renderWithQueries(<Page />);
    const note = screen.getByRole("status");
    expect(within(note).getByRole("heading", { name: "Password changed" })).toBeTruthy();
    expect(note.textContent).toContain("Your password is changed. Sign in with your new one.");
    expect(screen.getByRole("tab", { name: "Sign in" }).getAttribute("aria-selected")).toBe("true");
  });

  it("goes when she switches tabs, and never shows without the flag", () => {
    search.mockReturnValue({ reset: "done" });
    renderWithQueries(<Page />);
    fireEvent.click(screen.getByRole("tab", { name: "Create account" }));
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    search.mockReturnValue({});
    renderWithQueries(<Page />);
    expect(screen.queryByText(/password is changed/)).toBeNull();
  });

  it("validateSearch keeps only reset=done", () => {
    const validate = Route.options.validateSearch as (s: Record<string, unknown>) => unknown;
    expect(validate({ reset: "done" })).toEqual({ reset: "done" });
    expect(validate({ reset: "yes", mode: "forgot" })).toEqual({ mode: "forgot" });
  });
});
