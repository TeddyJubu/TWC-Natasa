// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { isRedirect } from "@tanstack/react-router";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route as GuardRoute } from "@/routes/_authenticated/_admin/route";
import { Route } from "@/routes/_authenticated/_admin/admin";

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
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

  it("resolves when is_admin() is true", async () => {
    fake.results = [{ data: true, error: null }];
    await expect(beforeLoad()).resolves.toBeUndefined();
    expect(fake.calls).toEqual([["rpc", "is_admin"]]);
  });

  it("redirects to /account when is_admin() is false", async () => {
    fake.results = [{ data: false, error: null }];
    await redirectsToAccount();
  });

  it("redirects to /account when is_admin() errors", async () => {
    fake.results = [{ data: true, error: { message: "offline" } }];
    await redirectsToAccount();
  });

  it("redirects for anything but exactly true", async () => {
    fake.results = [{ data: "true", error: null }];
    await redirectsToAccount();
  });
});

describe("/admin", () => {
  describe("applications", () => {
    it("lists pending first and says whether each is linked to an account", async () => {
      fake.results = [{
        data: [
          application("a-old", "Old Approved", { status: "approved", created_at: "2026-11-05T00:00:00Z", reviewed_at: "2026-11-06T00:00:00Z", reviewed_by: "admin-1" }),
          application("a-pend", "Pia Pending", { user_id: "u9" }),
        ],
        error: null,
      }];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const rows = await screen.findAllByRole("article");
      expect(rows.map((r) => within(r).getByRole("heading").textContent)).toEqual(["Pia Pending", "Old Approved"]);
      expect(rows[0].textContent).toMatch(/Linked to an account/);
      expect(rows[1].textContent).toMatch(/No account yet/);
      expect(rows[1].textContent).toMatch(/by Natasa Admin/);
      expect(rows[0].textContent).toMatch(/Industry/);
    });

    it("approves an application and shows the new status after the refetch", async () => {
      fake.results = [{ data: [application("a1", "Pia Pending")], error: null }];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const row = await screen.findByRole("article");
      fake.results = [
        { data: null, error: null }, // the update
        { data: [application("a1", "Pia Pending", { status: "approved", reviewed_at: "2026-11-08T12:00:00Z", reviewed_by: "admin-1" })], error: null },
        { data: members, error: null }, // members refetch: profiles…
        { data: [], error: null }, // …and applicant emails
      ];
      fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["update", { status: "approved" }]));
      expect(fake.calls).toContainEqual(["eq", "id", "a1"]);
      await waitFor(() => expect(screen.getByRole("article").textContent).toMatch(/Approved/));
      expect(screen.getByRole("article").textContent).toMatch(/by Natasa Admin/);
    });

    it("shows a failed review as an alert and re-enables the buttons", async () => {
      fake.results = [{ data: [application("a1", "Pia Pending")], error: null }];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const row = await screen.findByRole("article");
      fake.results = [{ data: null, error: { message: "permission denied" } }];
      const approve = within(row).getByRole("button", { name: /approve/i }) as HTMLButtonElement;
      fireEvent.click(approve);
      expect((await within(row).findByRole("alert")).textContent).toMatch(/permission denied/);
      expect(approve.disabled).toBe(false);
    });

    it("says when reviewer names can't load, with a Retry, instead of hiding it", async () => {
      fake.results = [{ data: null, error: { message: "offline" } }, { data: [], error: null }];
      renderWithQueries(<Page />, [[["admin", "applications"], [application("a1", "Pia Pending", { status: "approved", reviewed_by: "admin-1" })]]]);
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/member names/i);
      fake.results = [{ data: members, error: null }, { data: [], error: null }];
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(screen.getByRole("article").textContent).toMatch(/by Natasa Admin/));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows a load error with a Retry that refetches", async () => {
      fake.results = [{ data: null, error: { message: "offline" } }];
      renderWithQueries(<Page />, [[["admin", "members"], members]]);
      const alert = await screen.findByRole("alert");
      fake.results = [{ data: [application("a1", "Pia Pending")], error: null }];
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
    fake.results = [{ data: null, error: null }, { data: [{ ...booking, status: "confirmed" }], error: null }];
    fireEvent.click(within(row).getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(fake.calls).toContainEqual(["update", { status: "confirmed" }]));
    expect(fake.calls).toContainEqual(["from", "headshot_bookings"]);
    await waitFor(() => expect(screen.getByRole("article").textContent).toMatch(/Confirmed/));
  });

  it("bookings: when member names fail, shows an inline error with Retry instead of Unknown member", async () => {
    const booking = { id: "b1", user_id: "u1", preferred_date: "2026-12-03", preferred_time: "Morning", notes: "", status: "requested", created_at: "" };
    const failed = [{ data: null, error: { message: "offline" } }, { data: [], error: null }];
    fake.results = [...failed, ...failed];
    renderWithQueries(<Page />, [[["admin", "applications"], []], [["admin", "bookings"], [booking]]]);
    await settle();
    fireEvent.click(screen.getByRole("tab", { name: "Bookings" }));
    await settle();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/member names/i);
    expect(screen.queryByText(/unknown member/i)).toBeNull();
    fake.results = [{ data: members, error: null }, { data: [], error: null }];
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
    fake.results = [{ data: null, error: null }];
    fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(fake.calls).toContainEqual(["update", { status: "approved" }]));
    expect(fake.calls.slice(0, 3)).toEqual([["from", "profiles"], ["update", { status: "approved" }], ["eq", "id", "u2"]]);
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
      fake.results = [{ data: null, error: null }, { data: [hood, created], error: null }];
      fireEvent.submit(form);
      await waitFor(() =>
        expect(fake.calls).toContainEqual(["insert", { name: "Woodside", slug: "woodside", color: "#2f9dff", sort_order: 2 }]),
      );
      expect(fake.calls.some((c) => c[0] === "upload")).toBe(false);
      expect(await screen.findByRole("form", { name: "Edit Woodside" })).toBeTruthy();
    });

    it("switching an existing row off sends active: false", async () => {
      open();
      const form = screen.getByRole("form", { name: "Edit Astoria" });
      fireEvent.click(within(form).getByRole("switch", { name: /^Active/ }));
      fake.results = [{ data: null, error: null }, { data: [{ ...hood, active: false }], error: null }];
      fireEvent.click(within(form).getByRole("button", { name: /save astoria/i }));
      await waitFor(() =>
        expect(fake.calls).toContainEqual(["update", { name: "Astoria", color: "#ff9a1f", active: false, sort_order: 1 }]),
      );
      expect(fake.calls).toContainEqual(["eq", "slug", "astoria"]);
      await waitFor(() => expect(screen.getByRole("form", { name: "Edit Astoria" }).textContent).toMatch(/Inactive/));
    });

    it("rejects a JPG logo with a clear message before any upload", async () => {
      open();
      const input = screen.getByLabelText(/new logo/i, { selector: "#hood-astoria-logo" });
      fireEvent.change(input, { target: { files: [new File(["x"], "l.jpg", { type: "image/jpeg" })] } });
      expect((await screen.findByRole("alert")).textContent).toMatch(/PNG or WebP/);
      fireEvent.click(screen.getByRole("button", { name: /save astoria/i }));
      await settle();
      expect(fake.calls.some((c) => c[0] === "upload" || c[0] === "update")).toBe(false);
    });
  });
});
