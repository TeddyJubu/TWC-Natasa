// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/features/forms-state/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { Route as GuardRoute } from "@/routes/_authenticated/_admin/route";
import { Route } from "@/routes/_authenticated/_admin/admin";
import { Route as FormsRoute } from "@/routes/_authenticated/_admin/admin_.forms";

const Page = Route.options.component as React.ComponentType;
const FormsPage = FormsRoute.options.component as React.ComponentType;
for (const r of [Route, FormsRoute]) vi.spyOn(r, "useRouteContext").mockReturnValue({ user: { id: "admin1", email: "natasa@x.test", name: "Natasa Admin" } } as never);
afterEach(() => {
  cleanup();
  fake.reset();
  emailApproval.mockClear();
});

const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

const member = (id: string, full_name: string, over: Record<string, unknown> = {}) => ({
  id, full_name, status: "approved", directory_visible: true, public_profile: false, catalogue_number: 3,
  role_title: "", business: "", neighborhood: "Astoria", specialty: "", bio: "", looking_for: "", website: "",
  avatar_path: null, member_since: null, created_at: "", updated_at: "", email: null, newsletter: null, applications: 0, ...over,
});
const members = [member("admin-1", "Natasa Admin"), member("u1", "Rosa Diaz", { email: "rosa@x.test" })];

const application = (id: string, full_name: string, over: Record<string, unknown> = {}) => ({
  id, full_name, email: `${id}@x.test`, neighborhood: "Astoria", status: "pending", user_id: null,
  created_at: "2026-11-01T15:00:00Z", reviewed_at: null, reviewed_by: null, answers: { industry: ["Food"] }, duplicate: null, ...over,
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
type AdminKey = "inbox" | "applications" | "members" | "neighborhoods" | "bookings" | "events" | "review-links" | "spotlight-links" | "reviews" | "spotlights" | "forms-state" | "form-responses" | "notes" | "actions" | "logged-actions" | "newsletter";
const formsState = [
  { kind: "application", open: true, message: "", updated_at: "2026-11-10T00:00:00Z", updated_by: null },
  { kind: "review", open: true, message: "", updated_at: "2026-11-10T00:00:00Z", updated_by: null },
];
/** Seeds every admin read (empty lists, plus `members`) unless overridden; FETCH leaves that read to the queued fake results. */
function renderAdmin(over: Partial<Record<AdminKey, unknown>> = {}, extra: [unknown[], unknown][] = [], Component = Page) {
  const data: Record<AdminKey, unknown> = { inbox: [], applications: [], members, neighborhoods: [], bookings: [], events: [], "review-links": {}, "spotlight-links": {}, reviews: [], spotlights: [], "forms-state": formsState, "form-responses": [], notes: [], actions: [], "logged-actions": [], newsletter: [], ...over };
  const seed = Object.entries(data).filter(([, v]) => v !== FETCH).map(([k, v]) => [["admin", k], v] as [unknown[], unknown]);
  return renderWithQueries(<Component />, [...seed, ...extra]);
}
const renderForms = (over: Partial<Record<AdminKey, unknown>> = {}) => renderAdmin(over, [], FormsPage);
const card = (name: string) => screen.getByRole("region", { name });

describe("/admin", () => {
  // Decisions (approve / decline / undo / booking confirm) ask window.confirm first (CRM-071).
  let confirm: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { confirm = vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { confirm.mockRestore(); });

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
      for (const [name, id] of [["Inbox", "inbox"], ["Applications", "applications"], ["All members", "members"], ["Newsletter", "newsletter"], ["Admin activity", "activity"], ["Member reviews", "reviews"], ["Spotlight answers", "spotlight"], ["Neighborhoods", "neighborhoods"], ["Headshot bookings", "bookings"], ["Gatherings", "gatherings"]]) {
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
      // Forms are their own page now: router links, never cards here.
      expect(screen.queryByRole("region", { name: "Your forms" })).toBeNull();
      expect(link("Your forms").getAttribute("href")).toBe("/admin/forms#forms");
      expect(link("Join & review").getAttribute("href")).toBe("/admin/forms#membership-forms");
    });

    it("/admin/forms is its own page: Forms h1, both form cards anchored, and Your forms marked here", () => {
      renderForms();
      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Forms"]);
      expect(card("Your forms").id).toBe("forms");
      expect(card("Join & review").id).toBe("membership-forms");
      expect(screen.queryByRole("region", { name: "Inbox" })).toBeNull();
      const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
      const link = (name: string) => within(nav).getByRole("link", { name });
      expect(link("Your forms").getAttribute("href")).toBe("#forms");
      expect(link("Your forms").getAttribute("aria-current")).toBe("location");
      expect(link("Inbox").getAttribute("href")).toBe("/admin#inbox");
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
      expect(within(inbox).getByLabelText("View")).toBeTruthy();
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

    it("Archived filter lists archived messages and hides Archive", () => {
      renderAdmin({
        inbox: [
          msg("m1"),
          msg("m2", { name: "Ana Ruiz", email: "ana@x.test", status: "archived", created_at: "2026-10-01T15:00:00Z" }),
        ],
      });
      const inbox = card("Inbox");
      expect(within(inbox).getByText(/1 waiting/)).toBeTruthy();
      expect(within(inbox).getByRole("article", { name: "Rosa Diaz" })).toBeTruthy();
      expect(within(inbox).queryByRole("article", { name: "Ana Ruiz" })).toBeNull();
      fireEvent.change(within(inbox).getByLabelText("View"), { target: { value: "archived" } });
      expect(within(inbox).getByText(/1 archived/)).toBeTruthy();
      expect(within(inbox).queryByRole("article", { name: "Rosa Diaz" })).toBeNull();
      const ana = within(inbox).getByRole("article", { name: "Ana Ruiz" });
      expect(within(ana).queryByRole("button", { name: /Archive/ })).toBeNull();
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
      const search = screen.getByRole("searchbox", { name: "Search messages, applications, members and newsletter" });
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
      fake.results = ["n1", [], []];
      fireEvent.change(within(apps).getByLabelText(/Add a note about Pia Baker/), { target: { value: "Wants May salon" } });
      fireEvent.click(within(apps).getByRole("button", { name: "Add note" }));
      await settle();
      expect(fake.calls).toEqual([["addNoteFn", { applicationId: "a1", body: "Wants May salon" }], ["adminNotesFn"], ["adminActionsFn"]]);
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

  describe("filters, member detail and neighborhood (CRM-062, CRM-060, CRM-059)", () => {
    it("status filters compose with the search box", () => {
      renderAdmin({
        applications: [application("a1", "Pia Baker"), application("a2", "Pia Stone", { status: "approved" }), application("a3", "Lu Smith", { status: "approved" })],
        members: [...members, member("u2", "Ida Moss", { status: "pending", neighborhood: null })],
      });
      const apps = card("Applications");
      fireEvent.change(within(apps).getByLabelText("Status"), { target: { value: "approved" } });
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pia" } });
      expect(within(apps).getAllByRole("article").map((a) => a.querySelector("h3")!.textContent)).toEqual(["Pia Stone"]);
      expect(within(apps).getByText(/1 of 3 shown/)).toBeTruthy();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
      const all = card("All members");
      fireEvent.change(within(all).getByLabelText("Neighborhood"), { target: { value: " none" } });
      expect(within(all).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["Ida Moss"]);
      fireEvent.change(within(all).getByLabelText("Neighborhood"), { target: { value: "" } });
      fireEvent.change(within(all).getByLabelText("Status"), { target: { value: "approved" } });
      expect(within(all).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["Natasa Admin", "Rosa Diaz"]);
    });

    it("a member's Details show her newest application with its origin, and save a corrected neighborhood", async () => {
      renderAdmin({ applications: [
        application("old", "Rosa Diaz", { user_id: "u1", created_at: "2025-01-01T00:00:00Z", answers: { story: "Old story" } }),
        application("new", "Rosa Diaz", { user_id: "u1", status: "approved", neighborhood: "Ridgewood", answers: { base_area: "Other", goal_codes: ["x"], legacy: { origin: "Old HeyForm" } } }),
      ] }, [[["neighborhoods"], [{ slug: "astoria", name: "Astoria", color: "#ff9a1f", logoUrl: null, active: true }, { slug: "sunnyside", name: "Sunnyside", color: "#9b64ff", logoUrl: null, active: true }]]]);
      const row = within(card("All members")).getByRole("rowheader", { name: "Rosa Diaz" }).closest("tr")!;
      const details = within(row).getByText("Details").closest("details")!;
      expect(details.textContent).toContain("Old HeyForm");
      expect(details.textContent).toContain("Neighborhood given: Ridgewood");
      expect(details.textContent).toContain("Based in");
      expect(details.textContent).not.toContain("Old story");
      expect(details.textContent).not.toContain("Goal codes");
      const save = within(details).getByRole("button", { name: "Save" }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      fake.results = [undefined, members];
      fireEvent.change(within(details).getByLabelText("Neighborhood for Rosa Diaz"), { target: { value: "Sunnyside" } });
      fireEvent.click(save);
      await settle();
      expect(fake.calls[0]).toEqual(["setMemberNeighborhoodFn", { id: "u1", neighborhood: "Sunnyside" }]);
    });
  });

  describe("duplicates, member summary and admin activity (CRM-072/073, CRM-038, 0007)", () => {
    it("flags a possible duplicate on its row, counts it, and filters to just those", () => {
      renderAdmin({ applications: [application("a1", "Pia Baker", { duplicate: "member" }), application("a2", "Lu Smith")] });
      const apps = card("Applications");
      expect(within(apps).getByText(/1 possible duplicate ·/)).toBeTruthy();
      const pia = within(apps).getByRole("article", { name: "Pia Baker" });
      expect(within(pia).getByText("Possible duplicate")).toBeTruthy();
      expect(pia.textContent).toContain("This email already belongs to a member");
      expect(within(apps).getByRole("article", { name: "Lu Smith" }).textContent).not.toContain("Possible duplicate");
      fireEvent.change(within(apps).getByLabelText("Status"), { target: { value: "duplicate" } });
      expect(within(apps).getAllByRole("article").map((a) => a.querySelector("h3")!.textContent)).toEqual(["Pia Baker"]);
    });

    it("a member's Details open on her newsletter state, application count and member-since", () => {
      renderAdmin({ members: [member("u1", "Rosa Diaz", { newsletter: { consent: 1 }, applications: 2, member_since: "2025-03-04T12:00:00Z" })] });
      const summary = within(card("All members")).getByRole("list", { name: "Summary for Rosa Diaz" });
      expect(within(summary).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Newsletter (consented)", "2 applications", "Member since Mar 4, 2025"]);
    });

    it("lists who did what, newest first, and names removed people plainly", () => {
      renderAdmin({ actions: [
        { id: 2, action: "neighborhood", application_id: null, member_id: "u1", detail: "Astoria", created_at: "2026-11-02T10:00:00Z", actor_name: "Natasa", subject_name: "Rosa Diaz" },
        { id: 1, action: "approved", application_id: "gone", member_id: null, detail: "", created_at: "2026-11-01T10:00:00Z", actor_name: null, subject_name: null },
      ] });
      expect(within(card("Admin activity")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
        "Natasa set Rosa Diaz’s neighborhood to Astoria · Nov 2, 2026",
        "A removed admin approved a removed application · Nov 1, 2026",
      ]);
    });
  });

  describe("logged actions and newsletter (CRM-057/058/093)", () => {
    it("shows a logged action on an application and lets an admin add another", async () => {
      renderAdmin({
        applications: [application("a1", "Pia Baker")],
        "logged-actions": [{
          id: "la1", application_id: "a1", member_id: null, kind: "call", action_date: "2026-11-01", note: "Intro",
          removed_at: null, author_name: "Natasa", created_at: "2026-11-02T10:00:00Z", updated_at: "2026-11-02T10:00:00Z",
        }],
      });
      const row = within(card("Applications")).getByRole("article", { name: "Pia Baker" });
      expect(within(row).getByText((_, el) => el?.textContent === "Call · 2026-11-01 — Intro")).toBeTruthy();
      expect(within(row).getByText("Logged actions (1)")).toBeTruthy();
      fireEvent.change(within(row).getByLabelText("Type"), { target: { value: "meeting" } });
      fireEvent.change(within(row).getByLabelText("Date"), { target: { value: "2026-11-09" } });
      fake.results = ["la2", [{
        id: "la1", application_id: "a1", member_id: null, kind: "call", action_date: "2026-11-01", note: "Intro",
        removed_at: null, author_name: "Natasa", created_at: "2026-11-02T10:00:00Z", updated_at: "2026-11-02T10:00:00Z",
      }, {
        id: "la2", application_id: "a1", member_id: null, kind: "meeting", action_date: "2026-11-09", note: "",
        removed_at: null, author_name: "Natasa", created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z",
      }]];
      fireEvent.click(within(row).getByRole("button", { name: "Log action" }));
      await waitFor(() => expect(fake.calls[0]).toEqual(["addLoggedActionFn", { applicationId: "a1", kind: "meeting", actionDate: "2026-11-09", note: "" }]));
    });

    it("lists newsletter subscribers and filters them with the page search", async () => {
      renderAdmin({ newsletter: [
        { id: "n1", email: "new@x.test", full_name: "New", source: "website", consent: 1, subscribed_at: "2026-11-01T00:00:00Z" },
        { id: "n2", email: "old@x.test", full_name: "", source: "beehiiv", consent: null, subscribed_at: "2025-01-01T00:00:00Z" },
      ] });
      const panel = card("Newsletter");
      expect(within(panel).getByText("new@x.test")).toBeTruthy();
      expect(within(panel).getByText(/Consented · Website/)).toBeTruthy();
      expect(within(panel).getByText(/Imported — consent unknown · Beehiiv/)).toBeTruthy();
      fireEvent.change(screen.getByRole("searchbox", { name: "Search messages, applications, members and newsletter" }), { target: { value: "old@" } });
      expect(within(panel).queryByText("new@x.test")).toBeNull();
      expect(within(panel).getByText("old@x.test")).toBeTruthy();
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

    it("asks before approving, and offers Undo decline on a declined application", async () => {
      fake.results = [[application("a1", "Pia Pending", { status: "declined", reviewed_at: "2026-11-08T12:00:00Z" })]];
      renderAdmin({ applications: FETCH });
      const row = await within(card("Applications")).findByRole("article");
      expect(within(row).getByRole("button", { name: /undo decline/i })).toBeTruthy();
      confirm.mockReturnValueOnce(false);
      fireEvent.click(within(row).getByRole("button", { name: /undo decline/i }));
      expect(fake.calls.some((c) => c[0] === "reviewApplicationFn")).toBe(false);
      expect(confirm).toHaveBeenLastCalledWith("Undo decline for Pia Pending? She’ll go back to pending.");
      fake.results = [null, [application("a1", "Pia Pending", { status: "pending" })], members];
      confirm.mockReturnValueOnce(true);
      fireEvent.click(within(row).getByRole("button", { name: /undo decline/i }));
      await waitFor(() => expect(fake.calls).toContainEqual(["reviewApplicationFn", { id: "a1", status: "pending" }]));
      expect(emailApproval).not.toHaveBeenCalled();
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
    expect(fake.calls[0]).toEqual(["mintReviewLinkFn", { member_id: "u1", purpose: "review" }]);
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
    expect(fake.calls[0]).toEqual(["revokeReviewLinkFn", { member_id: "u1", purpose: "review" }]);
  });

  it("members: Invite to Spotlight makes a separate Spotlight link, shown once (CRM-083)", async () => {
    renderAdmin({ members: [member("u1", "Rosa Diaz")] });
    const row = screen.getByRole("row", { name: /Rosa Diaz/ });
    fake.results = [{ url: "https://new.example/spotlight?t=abc", expires_at: "2026-12-09T15:00:00Z" },
      { u1: { state: "active", created_at: "2026-11-09T15:00:00Z", expires_at: "2026-12-09T15:00:00Z", used_at: null } }];
    fireEvent.click(within(row).getByRole("button", { name: "Make a Spotlight link for Rosa Diaz" }));
    const url = (await within(row).findByRole("textbox", { name: /Shown once/ })) as HTMLInputElement;
    expect(url.value).toBe("https://new.example/spotlight?t=abc");
    expect(fake.calls[0]).toEqual(["mintReviewLinkFn", { member_id: "u1", purpose: "spotlight" }]);
    await waitFor(() => expect(row.textContent).toMatch(/Spotlight link open until/));
    expect(within(row).getByRole("button", { name: "Make a review link for Rosa Diaz" }).textContent).toBe("Make review link");
  });

  it("Spotlight answers: lists sent and imported answers with the question's words (CRM-037, CRM-097)", () => {
    renderAdmin({ spotlights: [
      { id: "s1", full_name: "Rosa Diaz", business: "Rosa’s", neighborhood: "Astoria", created_at: "2026-11-09T15:00:00Z", imported: false, member_id: "u1",
        answers: { "What Inspired You to Start": "Bread." } },
      { id: "s2", full_name: "Nell Fixture", business: "", neighborhood: "", created_at: "2026-10-01T12:00:00Z", imported: true, member_id: null,
        answers: { "Old Column": "Kept." } },
    ] });
    const panel = within(card("Spotlight answers"));
    const sent = panel.getByRole("article", { name: "Rosa Diaz" });
    expect(sent.textContent).toMatch(/Rosa’s · Astoria · Sent/);
    expect(sent.textContent).toMatch(/What inspired you to start your business or practice\?Bread\./);
    expect(panel.getByRole("article", { name: "Nell Fixture" }).textContent).toMatch(/Imported.*Old ColumnKept\./s);
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

  it("join & review: lists both switches and Close posts open:false with the message", async () => {
    renderForms({ "forms-state": [
      { kind: "application", open: true, message: "", updated_at: "2026-11-10T00:00:00Z", updated_by: null },
      { kind: "review", open: false, message: "Reviews paused.", updated_at: "2026-11-10T00:00:00Z", updated_by: "admin1" },
    ] });
    const join = within(card("Join & review")).getByRole("article", { name: "Membership application" });
    expect(within(join).getByRole("link", { name: "/join" }).getAttribute("href")).toBe("/join");
    expect(join.textContent).toMatch(/Open/);
    const review = within(card("Join & review")).getByRole("article", { name: "Member review" });
    expect(review.textContent).toMatch(/Closed/);
    expect(within(review).getByRole("button", { name: "Open Member review" })).toBeTruthy();
    fireEvent.change(within(join).getByLabelText("Closed message"), { target: { value: "Paused until spring." } });
    fake.results = [null, [
      { kind: "application", open: false, message: "Paused until spring.", updated_at: "2026-11-10T01:00:00Z", updated_by: "admin1" },
      { kind: "review", open: false, message: "Reviews paused.", updated_at: "2026-11-10T00:00:00Z", updated_by: "admin1" },
    ]];
    fireEvent.click(within(join).getByRole("button", { name: "Close Membership application" }));
    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(fake.calls[0]).toEqual(["setMembershipFormOpenFn", { kind: "application", open: false, message: "Paused until spring." }]));
  });

  it("form responses: each form with its count, link, newest date and answers under question labels", () => {
    const entries = [{ key: "name", label: "Your name", value: "Rosa Diaz" }, { key: "diet", label: "Anything we should know?", value: ["Vegan", "No nuts"] }];
    const questions = [{ key: "name", type: "short", label: "Your name", required: true }];
    renderForms({ "form-responses": [
      { id: "demo0001", name: "Salon RSVP (demo)", slug: "salon-rsvp", open: true, closed_message: "", intro: "", thanks: "", one_per_email: true, version: 1, questions, total: 1, newest_at: "2026-11-09T15:00:00Z", responses: [{ id: "a1", created_at: "2026-11-09T15:00:00Z", entries }] },
      { id: "demo0002", name: "Old survey (demo, closed)", slug: "old-survey", open: false, closed_message: "This survey has closed.", intro: "", thanks: "", one_per_email: false, version: 1, questions: [{ key: "feedback", type: "paragraph", label: "Your feedback", required: true }], total: 0, newest_at: null, responses: [] },
    ] });
    expect(within(card("Your forms")).getByRole("form", { name: "Add a form" })).toBeTruthy();
    const rsvp = within(card("Your forms")).getByRole("article", { name: "Salon RSVP (demo)" });
    expect(within(rsvp).getByRole("link", { name: "/f/salon-rsvp" }).getAttribute("href")).toBe("/f/salon-rsvp");
    expect(rsvp.textContent).toMatch(/1 answer/);
    expect(rsvp.textContent).toMatch(/v1/);
    expect(rsvp.textContent).toMatch(/one per email/);
    expect(rsvp.textContent).toMatch(/newest Nov 9, 2026/);
    expect(rsvp.textContent).toMatch(/Open/);
    expect(within(rsvp).getByRole("button", { name: "Close Salon RSVP (demo)" })).toBeTruthy();
    expect(within(rsvp).getByRole("button", { name: "Edit Salon RSVP (demo)" })).toBeTruthy();
    expect(within(rsvp).getByRole("button", { name: "Download CSV of Salon RSVP (demo)" })).toBeTruthy();
    expect(within(rsvp).getByText("Your name").nextElementSibling!.textContent).toBe("Rosa Diaz");
    expect(within(rsvp).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Vegan", "No nuts"]);
    const closed = within(card("Your forms")).getByRole("article", { name: "Old survey (demo, closed)" });
    expect(closed.textContent).toMatch(/0 answers/);
    expect(closed.textContent).toMatch(/Closed/);
    expect(within(closed).getByRole("button", { name: "Open Old survey (demo, closed)" })).toBeTruthy();
    expect(within(closed).queryByRole("button", { name: /Download CSV/ })).toBeNull();
  });

  it("form responses: Close form asks confirm then posts open:false with the closed message", async () => {
    renderForms({ "form-responses": [
      { id: "demo0001", name: "Salon RSVP (demo)", slug: "salon-rsvp", open: true, closed_message: "", intro: "", thanks: "", one_per_email: false, version: 1, questions: [{ key: "name", type: "short", label: "Your name" }], total: 0, newest_at: null, responses: [] },
    ] });
    const rsvp = within(card("Your forms")).getByRole("article", { name: "Salon RSVP (demo)" });
    fireEvent.change(within(rsvp).getByLabelText("Closed message"), { target: { value: "Full for now." } });
    fake.results = [null, [
      { id: "demo0001", name: "Salon RSVP (demo)", slug: "salon-rsvp", open: false, closed_message: "Full for now.", intro: "", thanks: "", one_per_email: false, version: 1, questions: [{ key: "name", type: "short", label: "Your name" }], total: 0, newest_at: null, responses: [] },
    ]];
    fireEvent.click(within(rsvp).getByRole("button", { name: "Close Salon RSVP (demo)" }));
    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(fake.calls[0]).toEqual(["setFormOpenFn", { id: "demo0001", open: false, message: "Full for now." }]));
  });

  it("form responses: Download CSV asks the server for that form's export", async () => {
    renderForms({ "form-responses": [
      { id: "demo0001", name: "Salon RSVP (demo)", slug: "salon-rsvp", open: true, closed_message: "", intro: "", thanks: "", one_per_email: false, version: 1, questions: [{ key: "name", type: "short", label: "Your name" }], total: 2, newest_at: "2026-11-09T15:00:00Z", responses: [] },
    ] });
    fake.results = [{ filename: "salon-rsvp-responses-2026-11-09.csv", csv: "\uFEFF\"Received (UTC)\"\r\n" }];
    const createObjectURL = vi.fn(() => "blob:csv");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(within(card("Your forms")).getByRole("button", { name: "Download CSV of Salon RSVP (demo)" }));
    await waitFor(() => expect(fake.calls).toEqual([["formResponsesCsvFn", { id: "demo0001" }]]));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it("form responses: Add a form publishes through saveAdminFormFn", async () => {
    renderForms({ "form-responses": [] });
    const add = within(card("Your forms")).getByRole("form", { name: "Add a form" });
    fireEvent.change(within(add).getByLabelText("Name"), { target: { value: "Coffee chat" } });
    fireEvent.change(within(add).getByLabelText("Slug"), { target: { value: "coffee-chat" } });
    fake.results = [{ id: "abcd1234" }, []];
    fireEvent.click(within(add).getByRole("button", { name: "Publish form" }));
    await waitFor(() => expect(fake.calls[0]?.[0]).toBe("saveAdminFormFn"));
    expect(fake.calls[0]?.[1]).toMatchObject({
      name: "Coffee chat", slug: "coffee-chat", open: true, one_per_email: false,
      questions: [
        { key: "name", type: "short", label: "Your name", required: true },
        { key: "email", type: "email", label: "Email", required: true },
      ],
    });
  });

  it("form responses: Edit form saves an existing definition", async () => {
    renderForms({ "form-responses": [
      { id: "demo0001", name: "Salon RSVP (demo)", slug: "salon-rsvp", open: true, closed_message: "", intro: "Hi", thanks: "Bye", one_per_email: true, version: 2, questions: [{ key: "name", type: "short", label: "Your name", required: true }], total: 0, newest_at: null, responses: [] },
    ] });
    const rsvp = within(card("Your forms")).getByRole("article", { name: "Salon RSVP (demo)" });
    fireEvent.click(within(rsvp).getByRole("button", { name: "Edit Salon RSVP (demo)" }));
    const edit = within(rsvp).getByRole("form", { name: "Edit Salon RSVP (demo)" });
    fireEvent.change(within(edit).getByLabelText("Name"), { target: { value: "Salon RSVP" } });
    fake.results = [{ id: "demo0001" }, []];
    fireEvent.click(within(edit).getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(fake.calls[0]).toEqual(["saveAdminFormFn", expect.objectContaining({
      id: "demo0001", name: "Salon RSVP", slug: "salon-rsvp", intro: "Hi", thanks: "Bye", one_per_email: true, open: true,
      questions: [{ key: "name", type: "short", label: "Your name", required: true }],
    })]));
  });

  it("members: approve sets the profile status directly", async () => {
    renderAdmin({ members: [member("u2", "Lena Ortiz", { status: "pending", catalogue_number: null, email: "lena@x.test" })] });
    const row = screen.getByRole("row", { name: /Lena Ortiz/ });
    expect(row.textContent).toMatch(/lena@x\.test/);
    fake.results = [null];
    fireEvent.click(within(row).getByRole("button", { name: /approve/i }));
    expect(confirm).toHaveBeenCalledWith("Approve Lena Ortiz?");
    await waitFor(() => expect(fake.calls[0]).toEqual(["setMemberStatusFn", { id: "u2", status: "approved" }]));
    // No application on file: a quiet notice, no email call.
    expect((await within(row).findByRole("status")).textContent).toBe("Approved — email not sent (no application on file)");
    expect(emailApproval).not.toHaveBeenCalled();
  });

  it("members: Undo decline is offered only when declined", () => {
    renderAdmin({ members: [
      member("u2", "Lena Ortiz", { status: "declined", catalogue_number: null }),
      member("u3", "Pat Pending", { status: "pending", catalogue_number: null }),
    ] });
    expect(within(screen.getByRole("row", { name: /Lena Ortiz/ })).getByRole("button", { name: /undo decline/i })).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /Pat Pending/ })).queryByRole("button", { name: /undo decline/i })).toBeNull();
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
      confirm.mockReturnValueOnce(false).mockReturnValueOnce(true);
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
      confirm.mockReturnValue(false);
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
