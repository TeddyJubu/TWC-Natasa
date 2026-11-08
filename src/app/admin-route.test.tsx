// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { isRedirect } from "@tanstack/react-router";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/admin/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
const emailApproval = vi.fn(async (_id: string) => ({ sent: true }) as { sent: true } | { sent: false; reason: string });
vi.mock("@/features/admin/approval-email", () => ({ emailApproval: (id: string) => emailApproval(id) }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { Route as GuardRoute } from "@/routes/_authenticated/_admin/route";
import { Route } from "@/routes/_authenticated/_admin/admin";

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
    emailApproval.mockClear();
});

const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

const member = (id: string, full_name: string, over: Record<string, unknown> = {}) => ({
  id, full_name, status: "approved", directory_visible: true, public_profile: false, catalogue_number: 3,
  role_title: "", business: "", neighborhood: "Astoria", specialty: "", bio: "", looking_for: "", website: "",
  avatar_path: null, member_since: null, created_at: "", updated_at: "", email: null, ...over,
});
const members = [member("admin-1", "Natasa Admin"), member("u1", "Rosa Diaz", { email: "rosa@x.test" })];

const application = (id: string, full_name: string, over: Record<string, unknown> = {}) => ({
  id, full_name, email: `${id}@x.test`, neighborhood: "Astoria", status: "pending", user_id: null,
  created_at: "2026-11-01T15:00:00Z", reviewed_at: null, reviewed_by: null, answers: { industry: ["Food"] }, ...over,
});

describe("_admin guard", () => {
  const beforeLoad = () => (GuardRoute.options.beforeLoad as (ctx: unknown) => Promise<unknown>)({});
  const redirectsToAccount = async () => {
    const thrown = await beforeLoad().then(() => null, (e: unknown) => e);
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: { to: string } }).options.to).toBe("/account");
  };

  it("resolves when the viewer is an admin", async () => {
    fake.results = [{ signedIn: true, member: true, admin: true }];
    await expect(beforeLoad()).resolves.toBeUndefined();
    expect(fake.calls).toEqual([["viewerFn"]]);
  });

  it("redirects to /account when the viewer is not an admin", async () => {
    fake.results = [{ signedIn: true, member: true, admin: false }];
    await redirectsToAccount();
  });

  it("redirects to /account when the check errors", async () => {
    fake.results = [new Error("offline")];
    await redirectsToAccount();
  });

  it("redirects for anything but exactly true", async () => {
    fake.results = [{ signedIn: true, member: true, admin: "true" }];
    await redirectsToAccount();
  });
});

describe("/admin", () => {
  describe("applications", () => {
    it("lists applications in the server's order (pending first) and says whether each is linked to an account", async () => {
      fake.results = [[
        application("a-pend", "Pia Pending", { user_id: "u9" }),
        application("a-old", "Old Approved", { status: "approved", created_at: "2026-11-05T00:00:00Z", reviewed_at: "2026-11-06T00:00:00Z", reviewed_by: "admin-1" }),
      ]];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const rows = await screen.findAllByRole("article");
      expect(rows.map((r) => within(r).getByRole("heading").textContent)).toEqual(["Pia Pending", "Old Approved"]);
      expect(rows[0].textContent).toMatch(/Linked to an account/);
      expect(rows[1].textContent).toMatch(/No account yet/);
      expect(rows[1].textContent).toMatch(/by Natasa Admin/);
      expect(rows[0].textContent).toMatch(/Industry/);
    });

    it("approves an application and shows the new status after the refetch", async () => {
      fake.results = [[application("a1", "Pia Pending")]];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const row = await screen.findByRole("article");
      fake.results = [
        null, // the review
        [application("a1", "Pia Pending", { status: "approved", reviewed_at: "2026-11-08T12:00:00Z", reviewed_by: "admin-1" })],
        members, // members refetch
      ];
      fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["reviewApplicationFn", { id: "a1", status: "approved" }]));
      await waitFor(() => expect(screen.getByRole("article").textContent).toMatch(/Approved/));
      expect(screen.getByRole("article").textContent).toMatch(/by Natasa Admin/);
      expect(emailApproval.mock.calls).toEqual([["a1"]]);
      expect(within(screen.getByRole("article")).getByRole("status").textContent).toBe("Welcome email sent");
    });

    it("says when the welcome email wasn't sent, with the reason", async () => {
      emailApproval.mockResolvedValueOnce({ sent: false, reason: "email isn’t set up" });
      fake.results = [[application("a1", "Pia Pending")]];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const row = await screen.findByRole("article");
      fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
      expect((await within(row).findByRole("status")).textContent).toBe("Approved — email not sent (email isn’t set up)");
    });

    it("never emails on a decline", async () => {
      fake.results = [[application("a1", "Pia Pending")]];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const row = await screen.findByRole("article");
      fireEvent.click(within(row).getByRole("button", { name: /decline/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["reviewApplicationFn", { id: "a1", status: "declined" }]));
      await settle();
      expect(emailApproval).not.toHaveBeenCalled();
      expect(within(row).queryByRole("status")).toBeNull();
    });

    it("shows a failed review as an alert and re-enables the buttons", async () => {
      fake.results = [[application("a1", "Pia Pending")]];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const row = await screen.findByRole("article");
      fake.results = [new Error("permission denied")];
      const approve = within(row).getByRole("button", { name: /approve/i }) as HTMLButtonElement;
      fireEvent.click(approve);
      expect((await within(row).findByRole("alert")).textContent).toMatch(/permission denied/);
      expect(approve.disabled).toBe(false);
    });

    it("says when reviewer names can't load, with a Retry, instead of hiding it", async () => {
      fake.results = [new Error("offline")];
      renderWithQueries(<Page />, [[["admin", "applications"], [application("a1", "Pia Pending", { status: "approved", reviewed_by: "admin-1" })]]]);
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/member names/i);
      fake.results = [members];
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(screen.getByRole("article").textContent).toMatch(/by Natasa Admin/));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows a load error with a Retry that refetches", async () => {
      fake.results = [new Error("offline")];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const alert = await screen.findByRole("alert");
      fake.results = [[application("a1", "Pia Pending")]];
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      expect(await screen.findByRole("article")).toBeTruthy();
    });
  });

  it("bookings: Confirm updates the booking and shows it confirmed", async () => {
    const booking = { id: "b1", user_id: "u1", preferred_date: "2026-12-03", preferred_time: "Morning", notes: "", status: "requested", created_at: "" };
    renderWithQueries(<Page />, [
      [["admin", "applications"], []],
      [["admin", "members"], members],
      [["admin", "bookings"], [booking]],
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Bookings" }));
    const row = screen.getByRole("article");
    expect(row.textContent).toMatch(/Rosa Diaz/);
    expect(row.textContent).toMatch(/Morning/);
    fake.results = [null, [{ ...booking, status: "confirmed" }]];
    fireEvent.click(within(row).getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(fake.calls).toContainEqual(["setBookingStatusFn", { id: "b1", status: "confirmed" }]));
    await waitFor(() => expect(screen.getByRole("article").textContent).toMatch(/Confirmed/));
  });

  it("bookings: when member names fail, shows an inline error with Retry instead of Unknown member", async () => {
    const booking = { id: "b1", user_id: "u1", preferred_date: "2026-12-03", preferred_time: "Morning", notes: "", status: "requested", created_at: "" };
    fake.results = [new Error("offline"), new Error("offline")];
    renderWithQueries(<Page />, [[["admin", "applications"], []], [["admin", "bookings"], [booking]]]);
    await settle();
    fireEvent.click(screen.getByRole("tab", { name: "Bookings" }));
    await settle();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/member names/i);
    expect(screen.queryByText(/unknown member/i)).toBeNull();
    fake.results = [members];
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("article").textContent).toMatch(/Rosa Diaz/));
  });

  it("members: the table scrolls in a focusable, labelled region", () => {
    renderWithQueries(<Page />, [[["admin", "applications"], []], [["admin", "members"], members]]);
    fireEvent.click(screen.getByRole("tab", { name: "Members" }));
    const region = screen.getByRole("region", { name: "Members" });
    expect(region.tabIndex).toBe(0);
    expect(within(region).getByRole("table")).toBeTruthy();
  });

  it("members: approve sets the profile status directly", async () => {
    renderWithQueries(<Page />, [
      [["admin", "applications"], []],
      [["admin", "members"], [member("u2", "Lena Ortiz", { status: "pending", catalogue_number: null, email: "lena@x.test" })]],
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Members" }));
    const row = screen.getByRole("row", { name: /Lena Ortiz/ });
    expect(row.textContent).toMatch(/lena@x\.test/);
    fake.results = [null];
    fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(fake.calls[0]).toEqual(["setMemberStatusFn", { id: "u2", status: "approved" }]));
    // No application on file: a quiet notice, no email call.
    expect((await within(row).findByRole("status")).textContent).toBe("Approved — email not sent (no application on file)");
    expect(emailApproval).not.toHaveBeenCalled();
  });

  it("members: approve emails the member's newest application", async () => {
    renderWithQueries(<Page />, [
      [["admin", "applications"], []],
      [["admin", "members"], [member("u2", "Lena Ortiz", { status: "pending", catalogue_number: null })]],
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Members" }));
    const row = screen.getByRole("row", { name: /Lena Ortiz/ });
    fake.results = ["app-9"];
    fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
    expect((await within(row).findByRole("status")).textContent).toBe("Welcome email sent");
    // The server returns her newest application's id for the email.
    expect(fake.calls[0]).toEqual(["setMemberStatusFn", { id: "u2", status: "approved" }]);
    expect(emailApproval.mock.calls).toEqual([["app-9"]]);
  });

  describe("neighborhoods", () => {
    const hood = { slug: "astoria", name: "Astoria", color: "#ff9a1f", logo_path: null, logoUrl: null, active: true, sort_order: 1, created_at: "" };
    const open = () => {
      renderWithQueries(<Page />, [[["admin", "applications"], []], [["admin", "members"], members], [["admin", "neighborhoods"], [hood]]]);
      fireEvent.click(screen.getByRole("tab", { name: "Neighborhoods" }));
    };

    it("shows the slug read-only for an existing row", () => {
      open();
      const slug = screen.getByLabelText("Slug", { selector: "#hood-astoria-slug" }) as HTMLInputElement;
      expect(slug.value).toBe("astoria");
      expect(slug.readOnly).toBe(true);
    });

    it("creating a neighborhood sends the insert", async () => {
      open();
      const form = screen.getByRole("form", { name: /add a neighborhood/i });
      fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "Woodside" } });
      fireEvent.change(within(form).getByLabelText("Slug"), { target: { value: "woodside" } });
      const created = { ...hood, slug: "woodside", name: "Woodside", color: "#2f9dff", sort_order: 2 };
      fake.results = [null, [hood, created]];
      fireEvent.submit(form);
      await waitFor(() =>
        expect(fake.calls).toContainEqual(["createNeighborhoodFn", { name: "Woodside", slug: "woodside", color: "#2f9dff", sort_order: 2 }]),
      );
      expect(fake.calls.some((c) => c[0] === "saveNeighborhoodLogoFn")).toBe(false);
      expect(await screen.findByRole("form", { name: "Edit Woodside" })).toBeTruthy();
    });

    it("switching an existing row off sends active: false", async () => {
      open();
      const form = screen.getByRole("form", { name: "Edit Astoria" });
      fireEvent.click(within(form).getByRole("switch", { name: /^Active/ }));
      fake.results = [null, [{ ...hood, active: false }]];
      fireEvent.click(within(form).getByRole("button", { name: /save astoria/i }));
      await waitFor(() =>
        expect(fake.calls).toContainEqual(["updateNeighborhoodFn", { slug: "astoria", name: "Astoria", color: "#ff9a1f", active: false, sort_order: 1 }]),
      );
      await waitFor(() => expect(screen.getByRole("form", { name: "Edit Astoria" }).textContent).toMatch(/Inactive/));
    });

    it("rejects a JPG logo with a clear message before any upload", async () => {
      open();
      const input = screen.getByLabelText(/new logo/i, { selector: "#hood-astoria-logo" });
      fireEvent.change(input, { target: { files: [new File(["x"], "l.jpg", { type: "image/jpeg" })] } });
      expect((await screen.findByRole("alert")).textContent).toMatch(/PNG or WebP/);
      fireEvent.click(screen.getByRole("button", { name: /save astoria/i }));
      await settle();
      expect(fake.calls).toEqual([]);
    });
  });
});
