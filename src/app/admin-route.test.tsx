// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { isRedirect } from "@tanstack/react-router";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/admin/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
const emailApproval = vi.fn(async (_id: string) => ({ sent: true }) as { sent: true } | { sent: false; reason: string });
vi.mock("@/features/admin/approval-email", () => ({ emailApproval: (id: string) => emailApproval(id) }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/member-links/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/forms/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { Route as GuardRoute } from "@/routes/_authenticated/_admin/route";
import { Route } from "@/routes/_authenticated/_admin/admin";

const Page = Route.options.component as React.ComponentType;
vi.spyOn(Route, "useRouteContext").mockReturnValue({ user: { id: "admin1", email: "natasa@x.test", name: "Natasa Admin" } } as never);
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

const FETCH = Symbol("fetch");
type AdminKey = "inbox" | "applications" | "members" | "neighborhoods" | "bookings" | "events" | "review-links" | "reviews" | "form-responses" | "notes";
/** Seeds every admin read (empty lists, plus `members`) unless overridden; FETCH leaves that read to the queued fake results. */
function renderAdmin(over: Partial<Record<AdminKey, unknown>> = {}, extra: [unknown[], unknown][] = []) {
  const data: Record<AdminKey, unknown> = { inbox: [], applications: [], members, neighborhoods: [], bookings: [], events: [], "review-links": {}, reviews: [], "form-responses": [], notes: [], ...over };
  const seed = Object.entries(data).filter(([, v]) => v !== FETCH).map(([k, v]) => [["admin", k], v] as [unknown[], unknown]);
  return renderWithQueries(<Page />, [...seed, ...extra]);
}
const card = (name: string) => screen.getByRole("region", { name });

describe("/admin", () => {
  describe("shell", () => {
    it("is one main landmark with the Admin h1 in the top bar, after the skip link", () => {
      const { container } = renderAdmin();
      const main = screen.getByRole("main");
      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect([main.id, main.tabIndex]).toEqual(["main", -1]);
      expect(container.querySelector("a")!.getAttribute("href")).toBe("#main");
      const h1 = screen.getAllByRole("heading", { level: 1 });
      expect(h1.map((h) => h.textContent)).toEqual(["Admin"]);
      expect(main.contains(h1[0])).toBe(true);
    });

    it("renders all six cards as anchored regions, and the sidebar marks the top one as here", () => {
      renderAdmin();
      for (const [name, id] of [["Inbox", "inbox"], ["Applications", "applications"], ["All members", "members"], ["Member reviews", "reviews"], ["Form responses", "forms"], ["Neighborhoods", "neighborhoods"], ["Headshot bookings", "bookings"], ["Gatherings", "gatherings"]]) {
        expect(card(name).id).toBe(id);
      }
      const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
      const link = (name: string) => within(nav).getByRole("link", { name });
      expect(link("Inbox").getAttribute("href")).toBe("#inbox");
      expect(link("Inbox").getAttribute("aria-current")).toBe("location");
      expect(link("Applications").getAttribute("href")).toBe("#applications");
      expect(link("Applications").getAttribute("aria-current")).toBeNull();
      expect(link("Headshot bookings").getAttribute("aria-current")).toBeNull();
      // Two "Gatherings": the members' list on /account, and this card (named apart for screen readers).
      expect(link("Gatherings").getAttribute("href")).toBe("/account#gatherings");
      expect(link("Admin Gatherings").getAttribute("href")).toBe("#gatherings");
      // The other internal page's cards are router links, never "here".
      expect(link("Profile").getAttribute("href")).toBe("/account#profile");
      expect(link("Profile").getAttribute("aria-current")).toBeNull();
      expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
    });
  });

  describe("inbox", () => {
    const msg = (id: string, over: Record<string, unknown> = {}) => ({
      id, kind: "contact", name: "Rosa Diaz", email: "rosa@x.test", topic: "Press", business: null, collaboration_type: null,
      message: "Line one\nLine two", status: "new", created_at: "2026-11-01T15:00:00Z", ...over,
    });

    it("lists each waiting message with its sender, what it's about and the message behind a disclosure", () => {
      renderAdmin({ inbox: [msg("m1"), msg("m2", { kind: "partnership", name: "Ana Ruiz", email: "ana@x.test", topic: null, business: "Ruiz Bakery", collaboration_type: "supply" })] });
      const inbox = card("Inbox");
      expect(within(inbox).getByText(/2 waiting/)).toBeTruthy();
      const rosa = within(inbox).getByRole("article", { name: "Rosa Diaz" });
      expect(within(rosa).getByRole("link", { name: "rosa@x.test" }).getAttribute("href")).toBe("mailto:rosa@x.test");
      expect(rosa.textContent).toContain("Press");
      expect(within(rosa).getByText("Contact")).toBeTruthy();
      expect(within(rosa).getByText("Message").closest("details")?.textContent).toContain("Line one\nLine two");
      const ana = within(inbox).getByRole("article", { name: "Ana Ruiz" });
      expect(ana.textContent).toContain("Partnership: Supply · Ruiz Bakery");
      expect(within(ana).getByText("Partnership")).toBeTruthy();
    });

    it("says when nothing is waiting", () => {
      renderAdmin();
      expect(within(card("Inbox")).getByText("Nothing waiting.")).toBeTruthy();
    });

    it("archives a message and refetches the inbox", async () => {
      renderAdmin({ inbox: [msg("m1")] });
      fake.results = [null, []];
      fireEvent.click(within(card("Inbox")).getByRole("button", { name: "Archive the message from Rosa Diaz" }));
      await settle();
      expect(fake.calls).toEqual([["archiveMessageFn", { id: "m1" }], ["adminInboxFn"]]);
      await waitFor(() => expect(within(card("Inbox")).getByText("Nothing waiting.")).toBeTruthy());
    });
  });

  describe("search, notes and CSV (CRM-041, CRM-055, CRM-186)", () => {
    it("one search box filters applications and members by name, email or business", async () => {
      renderAdmin({ applications: [application("a1", "Pia Baker", { answers: { business: "Crumb Co" } }), application("a2", "Lu Smith")] });
      const search = screen.getByRole("searchbox", { name: "Search messages, applications and members" });
      fireEvent.change(search, { target: { value: "crumb" } });
      expect(within(card("Applications")).getByRole("heading", { name: "Pia Baker" })).toBeTruthy();
      expect(within(card("Applications")).queryByRole("heading", { name: "Lu Smith" })).toBeNull();
      expect(within(card("All members")).getByText("No members match.")).toBeTruthy();
      fireEvent.change(search, { target: { value: "rosa@x" } });
      expect(within(card("All members")).getByRole("rowheader", { name: "Rosa Diaz" })).toBeTruthy();
      expect(within(card("All members")).queryByRole("rowheader", { name: "Natasa Admin" })).toBeNull();
    });

    it("adds a note to an application and refetches notes", async () => {
      renderAdmin({ applications: [application("a1", "Pia Baker")], notes: [{ id: "n0", application_id: "a1", member_id: null, author_name: "Natasa", body: "First call done", created_at: "2026-11-02T10:00:00Z" }] });
      const apps = card("Applications");
      expect(within(apps).getByText("Notes (1)")).toBeTruthy();
      expect(within(apps).getByText("First call done")).toBeTruthy();
      fake.results = ["n1", []];
      fireEvent.change(within(apps).getByLabelText(/Add a note about Pia Baker/), { target: { value: "Wants May salon" } });
      fireEvent.click(within(apps).getByRole("button", { name: "Add note" }));
      await settle();
      expect(fake.calls).toEqual([["addNoteFn", { applicationId: "a1", body: "Wants May salon" }], ["adminNotesFn"]]);
    });

    it("Download CSV asks the server for that card's export", async () => {
      renderAdmin();
      const createObjectURL = vi.fn(() => "blob:x");
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      fake.results = [{ filename: "twc-members-2026-11-09.csv", csv: "\uFEFF\"Name\"\r\n" }];
      fireEvent.click(within(card("All members")).getByRole("button", { name: "Download CSV of members" }));
      await settle();
      expect(fake.calls).toEqual([["adminCsvFn", { kind: "members" }]]);
      expect(click).toHaveBeenCalledOnce();
      click.mockRestore();
    });
  });

  it("arriving at /admin#bookings marks Headshot bookings as here and focuses its heading (route focus skips hash URLs)", () => {
    window.history.replaceState(null, "", "/admin#bookings");
    try {
      renderAdmin();
      const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
      expect(within(nav).getByRole("link", { name: "Headshot bookings" }).getAttribute("aria-current")).toBe("location");
      expect(document.activeElement).toBe(within(card("Headshot bookings")).getByRole("heading", { level: 2 }));
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  describe("applications", () => {
    it("lists applications in the server's order (pending first) and says whether each is linked to an account", async () => {
      fake.results = [[
        application("a-pend", "Pia Pending", { user_id: "u9" }),
        application("a-old", "Old Approved", { status: "approved", created_at: "2026-11-05T00:00:00Z", reviewed_at: "2026-11-06T00:00:00Z", reviewed_by: "admin-1" }),
      ]];
      renderAdmin({ applications: FETCH });
      const rows = await within(card("Applications")).findAllByRole("article");
      expect(rows.map((r) => within(r).getByRole("heading").textContent)).toEqual(["Pia Pending", "Old Approved"]);
      expect(rows[0].textContent).toMatch(/Linked to an account/);
      expect(rows[1].textContent).toMatch(/No account yet/);
      expect(rows[1].textContent).toMatch(/by Natasa Admin/);
      expect(rows[0].textContent).toMatch(/Industry/);
      expect(card("Applications").textContent).toMatch(/1 pending · 2 in total/);
    });

    it("approves an application and shows the new status after the refetch", async () => {
      fake.results = [[application("a1", "Pia Pending")]];
      renderAdmin({ applications: FETCH });
      const row = await within(card("Applications")).findByRole("article");
      fake.results = [
        null, // the review
        [application("a1", "Pia Pending", { status: "approved", reviewed_at: "2026-11-08T12:00:00Z", reviewed_by: "admin-1" })],
        members, // members refetch
      ];
      fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["reviewApplicationFn", { id: "a1", status: "approved" }]));
      const updated = () => within(card("Applications")).getByRole("article");
      await waitFor(() => expect(updated().textContent).toMatch(/Approved/));
      expect(updated().textContent).toMatch(/by Natasa Admin/);
      expect(emailApproval.mock.calls).toEqual([["a1"]]);
      expect(within(updated()).getByRole("status").textContent).toBe("Welcome email sent");
    });

    it("says when the welcome email wasn't sent, with the reason", async () => {
      emailApproval.mockResolvedValueOnce({ sent: false, reason: "email isn’t set up" });
      fake.results = [[application("a1", "Pia Pending")]];
      renderAdmin({ applications: FETCH });
      const row = await within(card("Applications")).findByRole("article");
      fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
      expect((await within(row).findByRole("status")).textContent).toBe("Approved — email not sent (email isn’t set up)");
    });

    it("never emails on a decline", async () => {
      fake.results = [[application("a1", "Pia Pending")]];
      renderAdmin({ applications: FETCH });
      const row = await within(card("Applications")).findByRole("article");
      fireEvent.click(within(row).getByRole("button", { name: /decline/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["reviewApplicationFn", { id: "a1", status: "declined" }]));
      await settle();
      expect(emailApproval).not.toHaveBeenCalled();
      expect(within(row).queryByRole("status")).toBeNull();
    });

    it("shows a failed review as an alert and re-enables the buttons", async () => {
      fake.results = [[application("a1", "Pia Pending")]];
      renderAdmin({ applications: FETCH });
      const row = await within(card("Applications")).findByRole("article");
      fake.results = [new Error("permission denied")];
      const approve = within(row).getByRole("button", { name: /approve/i }) as HTMLButtonElement;
      fireEvent.click(approve);
      expect((await within(row).findByRole("alert")).textContent).toMatch(/permission denied/);
      expect(approve.disabled).toBe(false);
    });

    it("says when reviewer names can't load, with a Retry, instead of hiding it", async () => {
      fake.results = [new Error("offline")];
      renderAdmin({ applications: [application("a1", "Pia Pending", { status: "approved", reviewed_by: "admin-1" })], members: FETCH });
      const alert = await within(card("Applications")).findByRole("alert");
      expect(alert.textContent).toMatch(/member names/i);
      fake.results = [members];
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(within(card("Applications")).getByRole("article").textContent).toMatch(/by Natasa Admin/));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows a load error with a Retry that refetches", async () => {
      fake.results = [new Error("offline")];
      renderAdmin({ applications: FETCH });
      const alert = await within(card("Applications")).findByRole("alert");
      fake.results = [[application("a1", "Pia Pending")]];
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      expect(await within(card("Applications")).findByRole("article")).toBeTruthy();
    });
  });

  const booking = { id: "b1", user_id: "u1", preferred_date: "2026-12-03", preferred_time: "Morning", notes: "", status: "requested", created_at: "" };

  it("bookings: Confirm updates the booking and shows it confirmed", async () => {
    renderAdmin({ bookings: [booking] });
    const row = within(card("Headshot bookings")).getByRole("article");
    expect(row.textContent).toMatch(/Rosa Diaz/);
    expect(row.textContent).toMatch(/Morning/);
    fake.results = [null, [{ ...booking, status: "confirmed" }]];
    fireEvent.click(within(row).getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(fake.calls).toContainEqual(["setBookingStatusFn", { id: "b1", status: "confirmed" }]));
    await waitFor(() => expect(within(card("Headshot bookings")).getByRole("article").textContent).toMatch(/Confirmed/));
  });

  it("bookings: when member names fail, shows an inline error with Retry instead of Unknown member", async () => {
    fake.results = [new Error("offline")];
    renderAdmin({ bookings: [booking], members: FETCH });
    await settle();
    const bookings = card("Headshot bookings");
    const alert = within(bookings).getByRole("alert");
    expect(alert.textContent).toMatch(/member names/i);
    expect(screen.queryByText(/unknown member/i)).toBeNull();
    fake.results = [members];
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(within(card("Headshot bookings")).getByRole("article").textContent).toMatch(/Rosa Diaz/));
  });

  it("members: the table scrolls in a focusable, labelled region", () => {
    renderAdmin();
    const region = within(card("All members")).getByRole("region", { name: "Members" });
    expect(region.tabIndex).toBe(0);
    expect(within(region).getByRole("table")).toBeTruthy();
  });

  it("members: Make review link shows the URL once, to copy, and refreshes the link state", async () => {
    renderAdmin({ members: [member("u1", "Rosa Diaz")], "review-links": {} });
    const row = screen.getByRole("row", { name: /Rosa Diaz/ });
    fake.results = [{ url: "https://new.example/review?t=abc", expires_at: "2026-12-09T15:00:00Z" },
      { u1: { state: "active", created_at: "2026-11-09T15:00:00Z", expires_at: "2026-12-09T15:00:00Z", used_at: null } }];
    fireEvent.click(within(row).getByRole("button", { name: "Make a review link for Rosa Diaz" }));
    const url = (await within(row).findByRole("textbox", { name: /Shown once/ })) as HTMLInputElement;
    expect(url.value).toBe("https://new.example/review?t=abc");
    expect(url.readOnly).toBe(true);
    expect(fake.calls[0]).toEqual(["mintReviewLinkFn", { member_id: "u1" }]);
    await waitFor(() => expect(row.textContent).toMatch(/Review link open until/));
    expect(within(row).getByRole("button", { name: "Revoke the review link for Rosa Diaz" })).toBeTruthy();
  });

  it("members: Revoke closes a live link; pending members get no link control", async () => {
    const live = { state: "active", created_at: "2026-11-09T15:00:00Z", expires_at: "2026-12-09T15:00:00Z", used_at: null };
    renderAdmin({ members: [member("u1", "Rosa Diaz"), member("u2", "Lena Ortiz", { status: "pending" })], "review-links": { u1: live } });
    expect(within(screen.getByRole("row", { name: /Lena Ortiz/ })).queryByRole("button", { name: /review link/ })).toBeNull();
    const row = screen.getByRole("row", { name: /Rosa Diaz/ });
    fake.results = [1, { u1: { ...live, state: "expired" } }];
    fireEvent.click(within(row).getByRole("button", { name: "Revoke the review link for Rosa Diaz" }));
    await waitFor(() => expect(row.textContent).toMatch(/Review link closed/));
    expect(fake.calls[0]).toEqual(["revokeReviewLinkFn", { member_id: "u1" }]);
  });

  it("member reviews: lists answers with their labels, and Mark handled clears one", async () => {
    const review = { id: "r1", member_id: "u1", full_name: "Rosa Diaz", created_at: "2026-11-09T15:00:00Z",
      answers: { full_name: "Rosa D.", email: "rosa@x.test", membership: "contact_me", correction_requests: ["req_info_correction"], other_note: "" } };
    renderAdmin({ reviews: [review] });
    const article = within(card("Member reviews")).getByRole("article", { name: "Rosa Diaz" });
    expect(article.textContent).toMatch(/I am not sure; please contact me\./);
    expect(article.textContent).toMatch(/Information correction/);
    fake.results = [null, []];
    fireEvent.click(within(article).getByRole("button", { name: "Mark the review from Rosa Diaz as handled" }));
    await waitFor(() => expect(within(card("Member reviews")).queryByRole("article")).toBeNull());
    expect(fake.calls[0]).toEqual(["markReviewDoneFn", { id: "r1" }]);
  });

  it("form responses: each form with its count, and every answer under its question's label", () => {
    const entries = [{ key: "name", label: "Your name", value: "Rosa Diaz" }, { key: "diet", label: "Anything we should know?", value: ["Vegan", "No nuts"] }];
    renderAdmin({ "form-responses": [
      { id: "demo0001", name: "Salon RSVP (demo)", slug: "salon-rsvp", open: true, total: 1, responses: [{ id: "a1", created_at: "2026-11-09T15:00:00Z", entries }] },
      { id: "demo0002", name: "Old survey (demo, closed)", slug: "old-survey", open: false, total: 0, responses: [] },
    ] });
    const rsvp = within(card("Form responses")).getByRole("article", { name: "Salon RSVP (demo)" });
    expect(rsvp.textContent).toMatch(/\/f\/salon-rsvp · 1 answer/);
    expect(rsvp.textContent).toMatch(/Open/);
    expect(within(rsvp).getByText("Your name").nextElementSibling!.textContent).toBe("Rosa Diaz");
    expect(within(rsvp).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Vegan", "No nuts"]);
    const closed = within(card("Form responses")).getByRole("article", { name: "Old survey (demo, closed)" });
    expect(closed.textContent).toMatch(/0 answers/);
    expect(closed.textContent).toMatch(/Closed/);
  });

  it("members: approve sets the profile status directly", async () => {
    renderAdmin({ members: [member("u2", "Lena Ortiz", { status: "pending", catalogue_number: null, email: "lena@x.test" })] });
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
    renderAdmin({ members: [member("u2", "Lena Ortiz", { status: "pending", catalogue_number: null })] });
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
    const open = () => renderAdmin({ neighborhoods: [hood] });

    it("shows the slug read-only for an existing row, its hint attached", () => {
      open();
      const slug = screen.getByLabelText("Slug", { selector: "#hood-astoria-slug" }) as HTMLInputElement;
      expect(slug.value).toBe("astoria");
      expect(slug.readOnly).toBe(true);
      expect(document.getElementById(slug.getAttribute("aria-describedby")!)!.textContent).toBe("Fixed after creation.");
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
      expect(fake.calls.some((c) => c[0] === "/api/neighborhood-logos")).toBe(false);
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

  describe("gatherings", () => {
    const guest = (user_id: string, full_name: string, over: Record<string, unknown> = {}) => ({
      user_id, full_name, catalogue_number: 14, neighborhood: "Jackson Heights", email: `${user_id}@x.test`, saved_at: "2030-10-02T12:00:00Z", ...over,
    });
    const gathering = (id: string, title: string, over: Record<string, unknown> = {}) => ({
      id, title, description: "Long-table dinner.", location: "Bistro on 37th Avenue", neighborhood: "Jackson Heights",
      starts_at: "2030-11-14T23:00:00.000Z", kind: "supper", guests: [] as unknown[], ...over,
    });
    const supper = gathering("e1", "Founders Supper Club", { guests: [guest("u1", "Rosa Diaz"), guest("u2", "", { catalogue_number: null, neighborhood: null })] });
    const past = gathering("e0", "Spring Picnic", { starts_at: "2020-05-01T16:00:00.000Z", kind: "gathering" });
    const gatherings = () => card("Gatherings");
    const field = (label: RegExp) => within(gatherings()).getByLabelText(label) as HTMLInputElement;
    const restore: (() => void)[] = [];
    afterEach(() => restore.splice(0).forEach((r) => r()));

    it("lists upcoming gatherings in New York time with their seat counts, and folds past ones away", () => {
      renderAdmin({ events: [past, supper] });
      const upcoming = within(gatherings()).getByRole("table", { name: "Upcoming gatherings" });
      const row = within(upcoming).getByRole("row", { name: /Founders Supper Club/ });
      expect(row.textContent).toMatch(/Nov14Thu · 6:00 PM/);
      expect(row.textContent).toMatch(/Supper · Bistro on 37th Avenue/);
      expect(row.textContent).toMatch(/Jackson Heights/);
      expect(within(row).getAllByRole("cell")[2].textContent).toBe("2");
      expect(within(gatherings()).getByText("Past gatherings (1)")).toBeTruthy();
      expect(within(gatherings()).getByRole("table", { name: "Past gatherings", hidden: true }).textContent).toMatch(/Spring Picnic/);
    });

    it("says when nothing is coming up", () => {
      renderAdmin();
      expect(within(gatherings()).getByText("Nothing on the calendar yet. Add the first gathering and members will see it on their account.")).toBeTruthy();
    });

    it("adds a gathering, reading the start as New York time, then refetches the list", async () => {
      renderAdmin();
      fireEvent.click(within(gatherings()).getByRole("button", { name: "Add a gathering" }));
      const form = within(gatherings()).getByRole("form", { name: "Add a gathering" });
      expect(document.activeElement).toBe(field(/title/i));
      fireEvent.change(field(/title/i), { target: { value: " Skyline Picnic " } });
      fireEvent.change(field(/kind/i), { target: { value: "gathering" } });
      fireEvent.change(field(/date and start time/i), { target: { value: "2030-07-04T12:30" } });
      fireEvent.change(field(/neighborhood/i), { target: { value: "Astoria" } });
      fireEvent.change(field(/location/i), { target: { value: "Rainey Park" } });
      fake.results = ["e9", [gathering("e9", "Skyline Picnic")]];
      fireEvent.submit(form);
      await waitFor(() => expect(fake.calls).toContainEqual(["createEventFn", {
        title: "Skyline Picnic", kind: "gathering", starts_at: "2030-07-04T16:30:00.000Z", neighborhood: "Astoria", location: "Rainey Park", description: "",
      }]));
      await waitFor(() => expect(within(gatherings()).getByRole("row", { name: /Skyline Picnic/ })).toBeTruthy());
      expect(within(gatherings()).queryByRole("form")).toBeNull();
    });

    it("won't send a gathering without a start time", async () => {
      renderAdmin();
      fireEvent.click(within(gatherings()).getByRole("button", { name: "Add a gathering" }));
      fireEvent.submit(within(gatherings()).getByRole("form", { name: "Add a gathering" }));
      expect((await within(gatherings()).findByRole("alert")).textContent).toMatch(/choose a date and start time/i);
      expect(field(/date and start time/i).getAttribute("aria-invalid")).toBe("true");
      expect(fake.calls).toEqual([]);
    });

    it("edits a gathering from its saved values and shows a server refusal", async () => {
      renderAdmin({ events: [supper] });
      fireEvent.click(within(gatherings()).getByRole("button", { name: "Edit Founders Supper Club" }));
      const form = within(gatherings()).getByRole("form", { name: "Edit Founders Supper Club" });
      expect(field(/date and start time/i).value).toBe("2030-11-14T18:00");
      expect(field(/neighborhood/i).value).toBe("Jackson Heights");
      expect(field(/kind/i).value).toBe("supper");
      fireEvent.change(field(/location/i), { target: { value: "Bistro on 82nd Street" } });
      fake.results = [new Error("Invalid neighborhood.")];
      fireEvent.submit(form);
      expect((await within(form).findByRole("alert")).textContent).toMatch(/invalid neighborhood/i);
      expect(fake.calls).toContainEqual(["updateEventFn", expect.objectContaining({ id: "e1", location: "Bistro on 82nd Street", starts_at: "2030-11-14T23:00:00.000Z" })]);
    });

    it("deletes a gathering only after a confirmation that names its saved seats", async () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
      restore.push(() => confirm.mockRestore());
      renderAdmin({ events: [supper] });
      fireEvent.click(within(gatherings()).getByRole("button", { name: "Edit Founders Supper Club" }));
      const remove = within(gatherings()).getByRole("button", { name: "Delete gathering" });
      fireEvent.click(remove);
      expect(confirm).toHaveBeenLastCalledWith("Delete Founders Supper Club? 2 saved seats go with it.");
      await settle();
      expect(fake.calls).toEqual([]);
      fake.results = [null, []];
      fireEvent.click(remove);
      await waitFor(() => expect(fake.calls).toContainEqual(["deleteEventFn", { id: "e1" }]));
      await waitFor(() => expect(within(gatherings()).queryByRole("row", { name: /Founders Supper Club/ })).toBeNull());
    });

    it("says one seat in the singular", () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      restore.push(() => confirm.mockRestore());
      renderAdmin({ events: [gathering("e2", "Coffee", { guests: [guest("u1", "Rosa Diaz")] })] });
      fireEvent.click(within(gatherings()).getByRole("button", { name: "Edit Coffee" }));
      fireEvent.click(within(gatherings()).getByRole("button", { name: "Delete gathering" }));
      expect(confirm).toHaveBeenCalledWith("Delete Coffee? 1 saved seat goes with it.");
    });

    it("shows a gathering's guest list and copies their emails", async () => {
      const writeText = vi.fn(async (_text: string) => undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      restore.push(() => Reflect.deleteProperty(navigator, "clipboard"));
      renderAdmin({ events: [supper] });
      fireEvent.click(within(gatherings()).getByRole("button", { name: "Guest list for Founders Supper Club" }));
      const list = within(gatherings()).getByRole("region", { name: "Guest list · Founders Supper Club" });
      expect(list.textContent).toMatch(/2 members saved a seat/);
      const guests = within(list).getAllByRole("listitem");
      expect(guests[0].textContent).toMatch(/Rosa Diaz.*Nº 014.*Jackson Heights.*u1@x\.test/);
      expect(guests[1].textContent).toMatch(/Unnamed member/);
      fireEvent.click(within(list).getByRole("button", { name: "Copy emails" }));
      expect((await within(list).findByRole("status")).textContent).toBe("Emails copied");
      expect(writeText).toHaveBeenCalledWith("u1@x.test, u2@x.test");
      fireEvent.click(within(list).getByRole("button", { name: /close the guest list/i }));
      expect(within(gatherings()).queryByRole("region", { name: /guest list/i })).toBeNull();
    });
  });
});
