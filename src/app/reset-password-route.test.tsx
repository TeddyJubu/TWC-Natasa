// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

const auth = vi.hoisted(() => ({ resetPassword: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/app/auth-client", () => ({ getAuthClient: async () => auth }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  ...(await import("@/test/dom")).routerStubs,
  useNavigate: () => navigate,
}));

import { Route } from "@/routes/reset-password";

const Page = Route.options.component as React.ComponentType;

// Better Auth's emailed link (/api/auth/reset-password/<token>) redirects here with ?token=… or ?error=INVALID_TOKEN.
beforeEach(() => window.history.replaceState(null, "", "/reset-password"));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const form = () => screen.queryByLabelText(/new password/i);
const forgotLink = () => screen.getByRole("link", { name: /request a new link/i });
const withToken = () => window.history.replaceState(null, "", "/reset-password?token=tok-123");
async function save(password = "a-new-password") {
  await waitFor(() => expect(form()).toBeTruthy());
  fireEvent.change(form()!, { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /save password/i }));
}

describe("/reset-password", () => {
  it("renders one main#main landmark (route focus target, T28)", async () => {
    renderWithQueries(<Page />);
    await screen.findByText(/link isn’t valid/i);
    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe("main");
    expect(mains[0].tabIndex).toBe(-1);
  });

  it("shows no form without a reset token, and links back to forgot-password", async () => {
    renderWithQueries(<Page />);
    expect(await screen.findByText(/link isn’t valid/i)).toBeTruthy();
    expect(form()).toBeNull();
    expect(forgotLink().getAttribute("href")).toBe("/auth?mode=forgot");
  });

  it("shows the form for a link with a token", async () => {
    withToken();
    renderWithQueries(<Page />);
    await waitFor(() => expect(form()).toBeTruthy());
  });

  it("explains an expired or used link from ?error=", async () => {
    window.history.replaceState(null, "", "/reset-password?error=INVALID_TOKEN");
    renderWithQueries(<Page />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/link has expired or was already used/i);
    expect(form()).toBeNull();
    expect(forgotLink().getAttribute("href")).toBe("/auth?mode=forgot");
  });

  it("saves the new password with the token, then goes to sign in", async () => {
    withToken();
    auth.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    renderWithQueries(<Page />);
    await save();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/auth" }));
    expect(auth.resetPassword).toHaveBeenCalledWith({ newPassword: "a-new-password", token: "tok-123" });
  });

  it("treats an invalid token on save as an expired link", async () => {
    withToken();
    auth.resetPassword.mockResolvedValue({ data: null, error: { code: "INVALID_TOKEN", message: "invalid token", status: 400 } });
    renderWithQueries(<Page />);
    await save();
    expect(await screen.findByText(/link has expired or was already used/i)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows any other error (e.g. the password rule) on the field", async () => {
    withToken();
    auth.resetPassword.mockResolvedValue({ data: null, error: { code: "PASSWORD_TOO_SHORT", message: "Password too short", status: 400 } });
    renderWithQueries(<Page />);
    await save("short");
    expect(await screen.findByText("Password too short")).toBeTruthy();
    expect(form()!.getAttribute("aria-invalid")).toBe("true");
    expect(form()!.getAttribute("aria-describedby")).toBe("password-hint password-error");
  });

  it("says one safe line when the save fails for any other reason", async () => {
    withToken();
    auth.resetPassword.mockResolvedValue({ data: null, error: { code: "INTERNAL", message: "db is locked", status: 500 } });
    renderWithQueries(<Page />);
    await save();
    expect((await screen.findByRole("alert")).textContent).toBe("We couldn’t save your password. Please try again.");
    expect(screen.queryByText(/db is locked/)).toBeNull();
  });

  it("shows the checking state before the link is read, inside the site chrome with one h1", () => {
    const { container } = renderWithQueries(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "Choose a new password." })).toBeTruthy();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });
});
