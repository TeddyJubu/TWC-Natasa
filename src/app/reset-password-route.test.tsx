// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  ...(await import("@/test/dom")).routerStubs,
  useNavigate: () => navigate,
}));

import { Route } from "@/routes/reset-password";

const Page = Route.options.component as React.ComponentType;

const jwt = (payload: object) =>
  `h.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;
const session = (method: string) => ({ access_token: jwt({ sub: "u1", amr: [{ method, timestamp: 1 }] }) });

let emit: (event: string, s: unknown) => void = () => {};
beforeEach(() => {
  window.history.replaceState(null, "", "/reset-password");
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockImplementation((cb: typeof emit) => {
    emit = cb;
    return { data: { subscription: { unsubscribe() {} } } };
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const form = () => screen.queryByLabelText(/new password/i);
const forgotLink = () => screen.getByRole("link", { name: /request a new link/i });

describe("/reset-password", () => {
  it("renders one main#main landmark (route focus target, T28)", async () => {
    renderWithQueries(<Page />);
    await screen.findByText(/link isn’t valid/i);
    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe("main");
    expect(mains[0].tabIndex).toBe(-1);
  });

  it("shows no form without a recovery session, and links back to forgot-password", async () => {
    renderWithQueries(<Page />);
    expect(await screen.findByText(/link isn’t valid/i)).toBeTruthy();
    expect(form()).toBeNull();
    expect(forgotLink().getAttribute("href")).toBe("/auth?mode=forgot");
  });

  it("shows no form for an ordinary signed-in session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session("password") } });
    renderWithQueries(<Page />);
    expect(await screen.findByText(/link isn’t valid/i)).toBeTruthy();
    expect(form()).toBeNull();
  });

  it("shows the form for an existing recovery session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session("recovery") } });
    renderWithQueries(<Page />);
    await waitFor(() => expect(form()).toBeTruthy());
  });

  it("shows the form when a PASSWORD_RECOVERY event arrives", async () => {
    auth.getSession.mockReturnValue(new Promise(() => {})); // still initialising
    renderWithQueries(<Page />);
    expect(form()).toBeNull();
    emit("PASSWORD_RECOVERY", session("recovery"));
    await waitFor(() => expect(form()).toBeTruthy());
  });

  it("explains an expired link from the #error fragment", async () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    auth.getSession.mockResolvedValue({ data: { session: session("recovery") } });
    renderWithQueries(<Page />);
    expect(await screen.findByText(/link has expired or was already used/i)).toBeTruthy();
    expect(form()).toBeNull();
    expect(forgotLink().getAttribute("href")).toBe("/auth?mode=forgot");
  });

  it("explains a failed link from the ?error= query (PKCE)", async () => {
    window.history.replaceState(null, "", "/reset-password?error=access_denied&error_code=otp_expired");
    renderWithQueries(<Page />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/link has expired or was already used/i);
    expect(form()).toBeNull();
  });

  it("falls back to 'not valid' when the session can't be read", async () => {
    auth.getSession.mockRejectedValue(new Error("storage blocked"));
    renderWithQueries(<Page />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/link isn’t valid/i);
  });

  it("saves the new password and goes to the account", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session("recovery") } });
    auth.updateUser.mockResolvedValue({ error: null });
    renderWithQueries(<Page />);
    await waitFor(() => expect(form()).toBeTruthy());
    fireEvent.change(form()!, { target: { value: "a-new-password" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/account" }));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "a-new-password" });
  });

  it("treats an expired session error on save as an expired link", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session("recovery") } });
    auth.updateUser.mockResolvedValue({ error: { message: "Auth session missing!", name: "AuthSessionMissingError" } });
    renderWithQueries(<Page />);
    await waitFor(() => expect(form()).toBeTruthy());
    fireEvent.change(form()!, { target: { value: "a-new-password" } });
    fireEvent.click(screen.getByRole("button", { name: /save password/i }));
    expect(await screen.findByText(/link has expired or was already used/i)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
