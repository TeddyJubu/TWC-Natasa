// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

const auth = vi.hoisted(() => ({ listAccounts: vi.fn(), deleteUser: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
const emitted = vi.hoisted(() => [] as string[]);
vi.mock("@/app/auth-client", () => ({ getAuthClient: async () => auth }));
vi.mock("@/app/auth-events", async (orig) => ({ ...(await orig<object>()), emitAuthEvent: (e: string) => emitted.push(e) }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs, useNavigate: () => navigate }));

import { DeleteAccount } from "@/features/account/DeleteAccount";

const viewer = (admin: boolean) => [["viewer"], { signedIn: true, member: true, admin }] as [unknown[], unknown];
const open = () => fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Delete my account for good" }));

beforeEach(() => {
  auth.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }], error: null });
  auth.deleteUser.mockResolvedValue({ data: { success: true }, error: null });
  emitted.length = 0;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Delete my account", () => {
  it("asks first, then sends her password and signs her out to the home page", async () => {
    renderWithQueries(<DeleteAccount />, [viewer(false)]);
    expect(screen.queryByLabelText("Your password")).toBeNull();
    open();
    expect(screen.getByRole("form", { name: "Delete your account?" }).textContent).toMatch(/can’t be undone/);
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "correct horse" } });
    confirm();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    expect(auth.deleteUser).toHaveBeenCalledWith({ password: "correct horse" });
    expect(emitted).toEqual(["SIGNED_OUT"]);
  });

  it("Cancel goes back without deleting", () => {
    renderWithQueries(<DeleteAccount />, [viewer(false)]);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeTruthy();
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it.each([
    ["INVALID_PASSWORD", /didn’t match/],
    ["SESSION_EXPIRED", /sign out and sign in again/],
    ["SOMETHING_ELSE", /couldn’t delete your account/],
  ])("a %s refusal stays on the page as an alert", async (code, text) => {
    auth.deleteUser.mockResolvedValue({ data: null, error: { code, status: 400 } });
    renderWithQueries(<DeleteAccount />, [viewer(false)]);
    open();
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "x" } });
    confirm();
    expect((await screen.findByRole("alert")).textContent).toMatch(text);
    expect(navigate).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Delete my account for good" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a Google-only account confirms without a password field", async () => {
    auth.listAccounts.mockResolvedValue({ data: [{ providerId: "google" }], error: null });
    renderWithQueries(<DeleteAccount />, [viewer(false)]);
    open();
    await waitFor(() => expect(screen.queryByLabelText("Your password")).toBeNull());
    expect(screen.getByText(/sign in with Google/)).toBeTruthy();
    confirm();
    await waitFor(() => expect(auth.deleteUser).toHaveBeenCalledWith({}));
  });

  it("admins get no delete button", () => {
    renderWithQueries(<DeleteAccount />, [viewer(true)]);
    expect(screen.queryByRole("button", { name: "Delete my account" })).toBeNull();
    expect(screen.getByText(/Admin accounts can’t be deleted from here/)).toBeTruthy();
  });
});
