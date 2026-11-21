// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { isRedirect } from "@tanstack/react-router";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/admin/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
const emailApproval = vi.fn(async (_id: string) => ({ sent: true }) as { sent: true } | { sent: false; reason: string });
vi.mock("@/features/admin/approval-email", () => ({ emailApproval: (id: string) => emailApproval(id) }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs, useNavigate: () => navigate }));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/member-links/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/forms/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/forms-state/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/form-copy/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { Route as GuardRoute } from "@/routes/_authenticated/_admin/route";
import { Route } from "@/routes/_authenticated/_admin/admin";
import { Route as FormsRoute } from "@/routes/_authenticated/_admin/admin_.forms.index";
import { Route as SectionRoute } from "@/routes/_authenticated/_admin/admin_.$section";
import type { AdminSection } from "@/app/layout/shell-nav";
import {
  ActivityPanel, AdminSearch, ApplicationsPanel, BookingsPanel, InboxPanel, MemberReviewsPanel, MembersPanel,
  NeighborhoodsPanel, NewsletterPanel, SpotlightPanel,
} from "@/features/admin/panels";
import { Route as FormRoute } from "@/routes/_authenticated/_admin/admin_.forms.$formId";

const Page = Route.options.component as React.ComponentType;
const SectionPage = SectionRoute.options.component as React.ComponentType;
/** One section's page at /admin/<section>. */
const sectionPage = (section: AdminSection) => {
  vi.spyOn(SectionRoute, "useParams").mockReturnValue({ section } as never);
  return SectionPage;
};
/**
 * Every admin card in one tree, sharing one search box, so a card's own behaviour can be tested without its page frame
 * (each card is its own page at /admin/<section>; the page tests below cover that frame).
 */
function AllPanels() {
  const [query, setQuery] = React.useState("");
  return (
    <>
      <AdminSearch value={query} onChange={setQuery} />
      <InboxPanel query={query} /><ApplicationsPanel query={query} /><MembersPanel query={query} /><NewsletterPanel query={query} />
      <ActivityPanel /><MemberReviewsPanel /><SpotlightPanel /><NeighborhoodsPanel /><BookingsPanel />
    </>
  );
}
const FormsPage = FormsRoute.options.component as React.ComponentType;
const FormPage = FormRoute.options.component as React.ComponentType;
for (const r of [Route, FormsRoute, FormRoute, SectionRoute]) vi.spyOn(r, "useRouteContext").mockReturnValue({ user: { id: "admin1", email: "natasa@x.test", name: "Natasa Admin" } } as never);
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
function renderAdmin(over: Partial<Record<AdminKey, unknown>> = {}, extra: [unknown[], unknown][] = [], Component: React.ComponentType = AllPanels) {
  const data: Record<AdminKey, unknown> = { inbox: [], applications: [], members, neighborhoods: [], bookings: [], events: [], "review-links": {}, "spotlight-links": {}, reviews: [], spotlights: [], "forms-state": formsState, "form-responses": [], notes: [], actions: [], "logged-actions": [], newsletter: [], ...over };
  const seed = Object.entries(data).filter(([, v]) => v !== FETCH).map(([k, v]) => [["admin", k], v] as [unknown[], unknown]);
  return renderWithQueries(<Component />, [...seed, ...extra]);
}
const renderForms = (over: Partial<Record<AdminKey, unknown>> = {}) => renderAdmin(over, [], FormsPage);
/** One form's edit page at /admin/forms/<formId>; `copy` seeds the wording read for a built-in form. */
function renderFormPage(formId: string, over: Partial<Record<AdminKey, unknown>> = {}, copy?: [string, Record<string, string>], tab?: string) {
  vi.spyOn(FormRoute, "useParams").mockReturnValue({ formId } as never);
  vi.spyOn(FormRoute, "useSearch").mockReturnValue((tab ? { tab } : {}) as never);
  return renderAdmin(over, copy ? [[["admin", "form-copy", copy[0]], copy[1]]] : [], FormPage);
}
const demoForm = (over: Record<string, unknown> = {}) => ({
  id: "demo0001", name: "Salon RSVP (demo)", slug: "salon-rsvp", open: true, closed_message: "", intro: "", thanks: "", one_per_email: false, version: 1,
  questions: [{ key: "name", type: "short", label: "Your name", required: true }], total: 0, newest_at: null, responses: [],
  opens_at: null, closes_at: null, max_responses: null, confirm: false, state: over.open === false ? "closed" : "open", ...over,
});
const card = (name: string) => screen.getByRole("region", { name });

describe("/admin", () => {
  // Decisions (approve / decline / undo / booking confirm) ask window.confirm first (CRM-071).
  let confirm: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { confirm = vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { confirm.mockRestore(); });

  describe("shell", () => {
    it("is one main landmark with the Admin h1 in the top bar, after the skip link", () => {
      const { container } = renderAdmin({}, [], Page);
      const main = screen.getByRole("main");
      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect([main.id, main.tabIndex]).toEqual(["main", -1]);
      expect(container.querySelector("a")!.getAttribute("href")).toBe("#main");
      const h1 = screen.getAllByRole("heading", { level: 1 });
      expect(h1.map((h) => h.textContent)).toEqual(["Admin"]);
      expect(main.contains(h1[0])).toBe(true);
    });

    it("the overview is a card per area, each opening its own page, and the sidebar marks Overview as here", () => {
      renderAdmin({}, [], Page);
      // No card's contents here: only the way into each one.
      expect(screen.queryByRole("region", { name: "Applications" })).toBeNull();
      const tile = (name: string) => within(screen.getByRole("main")).getByRole("link", { name }).closest("article")!;
      for (const [name, href] of [["Inbox", "/admin/inbox"], ["Applications", "/admin/applications"], ["Member reviews", "/admin/reviews"], ["Headshot bookings", "/admin/bookings"],
        ["All members", "/admin/members"], ["Newsletter", "/admin/newsletter"], ["Spotlight answers", "/admin/spotlight"], ["Events", "/admin/gatherings"],
        ["Neighborhoods", "/admin/neighborhoods"], ["Forms", "/admin/forms"]]) {
        expect(within(tile(name)).getByRole("link", { name }).getAttribute("href")).toBe(href);
      }
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Waiting on you", "The club"]);
      // The log is a line under the cards, not a card.
      expect(within(screen.getByRole("main")).getByRole("link", { name: "Admin activity" }).getAttribute("href")).toBe("/admin/activity");
      const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
      const link = (name: string) => within(nav).getByRole("link", { name });
      expect(link("Overview").getAttribute("aria-current")).toBe("page");
      expect(link("Inbox").getAttribute("href")).toBe("/admin/inbox");
      expect(link("Inbox").getAttribute("aria-current")).toBeNull();
      expect(link("Profile").getAttribute("href")).toBe("/account#profile");
      expect(link("Forms").getAttribute("href")).toBe("/admin/forms#forms");
      // Forms come second in the Admin list, right after the overview.
      expect(within(nav).getAllByRole("link").map((a) => a.textContent).slice(4, 7)).toEqual(["Overview", "Forms", "Inbox"]);
      expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
    });

    it("the overview says what waits on you, and marks those cards", () => {
      renderAdmin({
        inbox: [
          { id: "m1", kind: "contact", name: "Ana", email: "ana@x.test", topic: "Press", business: null, collaboration_type: null, message: "Hi", status: "new", created_at: "2026-11-01T15:00:00Z" },
          { id: "m2", kind: "contact", name: "Bo", email: "bo@x.test", topic: "Press", business: null, collaboration_type: null, message: "Hi", status: "archived", created_at: "2026-11-01T15:00:00Z" },
        ],
        applications: [application("a1", "Pia Baker"), application("a2", "Lu Smith", { status: "approved" })],
      }, [], Page);
      expect(screen.getByRole("status").textContent).toBe("1 message and 1 application are waiting on you.");
      const tile = (name: string) => within(screen.getByRole("main")).getByRole("link", { name }).closest("article")!;
      expect(within(tile("Inbox")).getByText("to answer")).toBeTruthy();
      expect(within(tile("Applications")).getByText("2 in all")).toBeTruthy();
      expect(within(tile("Member reviews")).queryByText("to apply")).toBeNull();
    });

    it("the overview says so when nothing is waiting", () => {
      renderAdmin({}, [], Page);
      expect(screen.getByRole("status").textContent).toBe("Nothing is waiting on you.");
    });

    it("a section is its own page: its name as the h1, its one card, a search box where the card filters, and its sidebar link marked", () => {
      renderAdmin({ applications: [application("a1", "Pia Baker")] }, [], sectionPage("applications"));
      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Applications"]);
      expect(card("Applications").id).toBe("applications");
      expect(screen.queryByRole("region", { name: "All members" })).toBeNull();
      expect(screen.getByRole("searchbox", { name: "Search applications" })).toBeTruthy();
      const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
      expect(within(nav).getByRole("link", { name: "Applications" }).getAttribute("aria-current")).toBe("page");
      expect(within(nav).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBeNull();
      cleanup();
      renderAdmin({}, [], sectionPage("activity"));
      expect(screen.queryByRole("searchbox")).toBeNull();
    });

    it("an unknown section is a 404", () => {
      const beforeLoad = SectionRoute.options.beforeLoad as (ctx: { params: { section: string } }) => void;
      expect(() => beforeLoad({ params: { section: "nope" } })).toThrow();
      expect(() => beforeLoad({ params: { section: "inbox" } })).not.toThrow();
    });

    it("/admin/forms shows your own forms first, then the built-in ones, each card opening its edit page", () => {
      renderForms({ "form-responses": [demoForm({ total: 2, newest_at: "2026-11-09T15:00:00Z" })] });
      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Forms"]);
      expect(document.getElementById("forms")).toBeTruthy();
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Your forms", "Built-in forms"]);
      const builtIn = within(card("Built-in forms"));
      const yours = within(card("Your forms"));
      expect(yours.getAllByRole("article")).toHaveLength(1);
      // The newsletter has no page of its own: a note pointing at its subscribers, not a card.
      expect(builtIn.getAllByRole("article")).toHaveLength(4);
      expect(builtIn.queryByRole("article", { name: "Newsletter" })).toBeNull();
      expect(builtIn.getByRole("link", { name: "Newsletter" }).getAttribute("href")).toBe("/admin/newsletter");
      for (const [list, name, id, chip] of [
        [builtIn, "Membership application", "application", /Open/], [builtIn, "Member review", "review", /Open/],
        [builtIn, "Contact", "contact", /Always on/], [builtIn, "Partnership", "partnership", /Always on/],
        [yours, "Salon RSVP (demo)", "demo0001", /Open/],
      ] as const) {
        const one = list.getByRole("article", { name });
        // One link per card (it covers the whole card), straight to the form's edit page.
        expect(within(one).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([`/admin/forms/${id}`]);
        expect(one.textContent).toMatch(chip);
      }
      const salon = yours.getByRole("article", { name: "Salon RSVP (demo)" }).textContent;
      expect(salon).toMatch(/\/f\/salon-rsvp/);
      expect(salon).toMatch(/2 answers · newest Nov 9, 2026/);
      expect(card("Your forms").textContent).toMatch(/1 form at \/f\/…, 2 answers in all/);
      const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
      const link = (name: string) => within(nav).getByRole("link", { name });
      expect(link("Forms").getAttribute("href")).toBe("#forms");
      expect(link("Forms").getAttribute("aria-current")).toBe("location");
      expect(link("Inbox").getAttribute("href")).toBe("/admin/inbox");
    });

    it("a form of your own has a delete button that asks first, naming its answers; built-in forms have none", async () => {
      renderForms({ "form-responses": [demoForm({ total: 2 })] });
      const ask = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
      expect(within(card("Built-in forms")).queryAllByRole("button", { name: /^Delete/ })).toHaveLength(0);
      const del = within(card("Your forms")).getByRole("button", { name: "Delete Salon RSVP (demo)" });
      fake.reset();
      fireEvent.click(del);
      expect(ask.mock.calls[0]![0]).toMatch(/Delete “Salon RSVP \(demo\)” for good\? Its 2 answers go with it; download the CSV first.*\/f\/salon-rsvp/);
      expect(fake.calls).toEqual([]);
      fireEvent.click(del);
      await waitFor(() => expect(fake.calls[0]).toEqual(["deleteAdminFormFn", { id: "demo0001" }]));
      ask.mockRestore();
    });

    it("New form asks only for a name and web address, then folds away again", () => {
      renderForms({ "form-responses": [] });
      const yours = within(card("Your forms"));
      expect(yours.queryByRole("form", { name: "New form" })).toBeNull();
      const tile = yours.getByRole("button", { name: "New form" });
      expect(tile.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(tile);
      const form = yours.getByRole("form", { name: "New form" });
      expect(tile.getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(within(form).getByLabelText("Name"));
      // The web address follows the name until it's edited by hand.
      fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "Café supper, Nov!" } });
      expect((within(form).getByLabelText("Web address") as HTMLInputElement).value).toBe("cafe-supper-nov");
      fireEvent.click(within(form).getByRole("button", { name: "Cancel" }));
      expect(yours.queryByRole("form", { name: "New form" })).toBeNull();
      expect(document.activeElement).toBe(tile);
    });

    it("the list shows a closed join form as Closed", () => {
      renderForms({ "forms-state": [
        { kind: "application", open: false, message: "", updated_at: "", updated_by: null },
        { kind: "review", open: true, message: "", updated_at: "", updated_by: null },
      ] });
      expect(within(card("Built-in forms")).getByRole("article", { name: "Membership application" }).textContent).toMatch(/Closed/);
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
      const search = screen.getByRole("searchbox", { name: "Search" });
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
    it("long cards show 20 rows, then Show more", () => {
      renderAdmin({ members: Array.from({ length: 25 }, (_, i) => member(`m${i}`, `Member ${i}`)) });
      // Rows are counted with a selector: role queries over the whole admin page take seconds on the VPS's CPU.
      const all = card("All members");
      const rows = () => all.querySelectorAll("tbody > tr").length;
      expect(rows()).toBe(20);
      fireEvent.click(within(all).getByText("Show 5 more · 5 not shown"));
      expect(rows()).toBe(25);
      expect(within(all).queryByText(/Show \d+ more/)).toBeNull();
    });

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
      fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "old@" } });
      expect(within(panel).queryByText("new@x.test")).toBeNull();
      expect(within(panel).getByText("old@x.test")).toBeTruthy();
    });
  });

  it("an old /admin#<card> link (alert emails, bookmarks) forwards to that card's page", () => {
    window.history.replaceState(null, "", "/admin#bookings");
    try {
      renderAdmin({}, [], Page);
      expect(navigate).toHaveBeenCalledWith({ to: "/admin/$section", params: { section: "bookings" }, replace: true });
    } finally {
      window.history.replaceState(null, "", "/");
      navigate.mockReset();
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

  describe("a form's edit page", () => {
    const rsvp = (over: Record<string, unknown> = {}) => demoForm({
      questions: [
        { key: "name", type: "short", label: "Your name", required: true },
        { key: "coming", type: "radio", label: "Coming?", required: false, choices: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      ],
      ...over,
    });

    it("built-in: h1 is the form, with where it lives, its open/close switch and its wording", () => {
      renderFormPage("application", {}, ["application", { "Full name": "Your full name" }]);
      expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Membership application"]);
      expect(screen.getByRole("link", { name: "Back to forms" }).getAttribute("href")).toBe("/admin/forms");
      // The ticket: its state in a sentence, where it lives, and where its answers go.
      const summary = within(card("Summary"));
      expect(card("Summary").textContent).toMatch(/Open.*Visitors can fill it in now\./);
      expect(summary.getByRole("link", { name: /\/join/ }).getAttribute("href")).toBe("/join");
      expect(summary.getByRole("link", { name: "Applications" }).getAttribute("href")).toBe("/admin/applications");
      expect((within(card("Open or closed")).getByRole("switch", { name: /Open for answers/ }) as HTMLInputElement).checked).toBe(true);
      // The wording box starts from what the page says now: the saved text where there is one, the default elsewhere.
      const wording = within(card("Wording"));
      expect((wording.getByLabelText("Full name") as HTMLInputElement).value).toBe("Your full name");
      expect((wording.getByLabelText("Preferred name") as HTMLInputElement).value).toBe("Preferred name");
      expect(wording.getByRole("heading", { name: "Top of the page" })).toBeTruthy();
      expect(wording.getByRole("heading", { name: "Button and thank-you" })).toBeTruthy();
      // Groups fold: only the first starts open, and each says how many of its texts are changed.
      const groups = card("Wording").querySelectorAll("details");
      expect([...groups].map((d) => d.open)).toEqual([true, ...Array(groups.length - 1).fill(false)]);
      expect(card("Wording").textContent).toMatch(/1 changed/);
    });

    it("built-in: Save wording sends every text and is off until something changes", async () => {
      renderFormPage("contact", {}, ["contact", {}]);
      expect(screen.queryByRole("region", { name: "Open or closed" })).toBeNull();
      expect(card("Summary").textContent).toMatch(/Always on/);
      const save = within(card("Wording")).getByRole("button", { name: "Save wording" }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      // Two edits in one batch: each must keep its own text (a queued update can't read a cleared event target).
      act(() => {
        fireEvent.change(within(card("Wording")).getByLabelText("Say hello, neighbor."), { target: { value: "Hello, friend." } });
        fireEvent.change(within(card("Wording")).getByLabelText("Message received"), { target: { value: "Got it!" } });
      });
      expect(save.disabled).toBe(false);
      expect(within(card("Wording")).getByRole("status").textContent).toBe("2 unsaved changes");
      fake.results = [null, { "Say hello, neighbor.": "Hello, friend." }];
      fireEvent.click(save);
      await waitFor(() => expect(fake.calls[0]?.[0]).toBe("saveFormCopyFn"));
      const sent = fake.calls[0][1] as { form: string; values: Record<string, string> };
      expect(sent.form).toBe("contact");
      expect(sent.values["Say hello, neighbor."]).toBe("Hello, friend.");
      expect(sent.values["Message received"]).toBe("Got it!");
      expect(sent.values["Send message"]).toBe("Send message");
      await waitFor(() => expect(within(card("Wording")).getByRole("status").textContent).toMatch(/Saved/));
    });

    it("built-in: Discard changes puts the saved wording back", () => {
      renderFormPage("contact", {}, ["contact", {}]);
      const box = within(card("Wording")).getByLabelText("Send message") as HTMLInputElement;
      fireEvent.change(box, { target: { value: "Send it" } });
      fireEvent.click(within(card("Wording")).getByRole("button", { name: "Discard changes" }));
      expect(box.value).toBe("Send message");
    });

    it("built-in: the newsletter has no public page, so no wording to edit", () => {
      renderFormPage("newsletter");
      expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Newsletter"]);
      expect(within(card("Wording")).getByText(/no public page yet/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Save wording" })).toBeNull();
    });

    it("built-in: switching off asks first, then posts open:false with the message", async () => {
      renderFormPage("review", {}, ["review", {}]);
      const status = within(card("Open or closed"));
      fireEvent.change(status.getByLabelText("Closed message"), { target: { value: "Reviews paused." } });
      fake.results = [null, []];
      fireEvent.click(status.getByRole("switch", { name: /Open for answers/ }));
      expect(confirm).toHaveBeenCalledWith("Close “Member review”? Visitors will see the closed message instead of the form.");
      await waitFor(() => expect(fake.calls[0]).toEqual(["setMembershipFormOpenFn", { kind: "review", open: false, message: "Reviews paused." }]));
    });

    it("your own form: opens on Answers, with tabs for Questions and Settings", () => {
      const entries = [{ key: "name", label: "Your name", value: "Rosa Diaz" }, { key: "diet", label: "Anything we should know?", value: ["Vegan", "No nuts"] }];
      renderFormPage("demo0001", { "form-responses": [rsvp({ total: 1, newest_at: "2026-11-09T15:00:00Z", responses: [{ id: "a1", created_at: "2026-11-09T15:00:00Z", entries }] })] });
      expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Salon RSVP (demo)"]);
      const summary = within(card("Summary"));
      expect(summary.getByRole("link", { name: /\/f\/salon-rsvp/ }).getAttribute("href")).toBe("/f/salon-rsvp");
      expect(card("Summary").textContent).toMatch(/1answer/);
      const tabs = screen.getAllByRole("tab");
      expect(tabs.map((t) => [t.textContent, t.getAttribute("aria-selected")])).toEqual([["Answers", "true"], ["Questions", "false"], ["Settings", "false"]]);
      expect(screen.getByRole("tabpanel", { name: "Answers" })).toBeTruthy();
      const answers = within(card("Answers"));
      expect(answers.getByRole("button", { name: "Download CSV" })).toBeTruthy();
      expect(answers.getAllByRole("listitem").map((li) => li.textContent)).toContain("Vegan");
      // Each answer is titled by who sent it, with the rest of what she said as a one-line preview.
      const row = card("Answers").querySelector("summary")!;
      expect(row.textContent).toMatch(/RD.*Rosa Diaz.*Vegan, No nuts.*Nov 9, 2026/);
      // Arrow keys move between tabs; the panels stay mounted, only hidden.
      fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
      expect(screen.getByRole("tab", { name: "Questions" }).getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Questions" }));
      expect(screen.getByRole("tabpanel", { name: "Questions" })).toBeTruthy();
      expect(document.getElementById("form-panel-answers")!.hidden).toBe(true);
    });

    it("your own form: ?tab=settings opens on Settings; no answers yet says how to get some", () => {
      renderFormPage("demo0001", { "form-responses": [rsvp()] }, undefined, "settings");
      expect(screen.getByRole("tab", { name: "Settings" }).getAttribute("aria-selected")).toBe("true");
      // The other tabs' panels are hidden, so out of the accessibility tree until chosen.
      expect(screen.queryByRole("region", { name: "Answers" })).toBeNull();
      fireEvent.click(screen.getByRole("tab", { name: "Answers" }));
      expect(card("Answers").textContent).toMatch(/no answers yet.*Share the link above/);
      expect(within(card("Answers")).queryByRole("button", { name: "Download CSV" })).toBeNull();
    });

    it("your own form: the ticket's Change in Settings goes to the Settings tab", () => {
      renderFormPage("demo0001", { "form-responses": [rsvp()] });
      fireEvent.click(within(card("Summary")).getByRole("button", { name: "Change in Settings" }));
      expect(screen.getByRole("tab", { name: "Settings" }).getAttribute("aria-selected")).toBe("true");
    });

    it("your own form: an unknown id says so", () => {
      renderFormPage("nope0000", { "form-responses": [demoForm()] });
      expect(card("Form not found")).toBeTruthy();
    });

    it("your own form: switching off asks first, then posts open:false with the closed message", async () => {
      renderFormPage("demo0001", { "form-responses": [rsvp()] }, undefined, "settings");
      const status = within(card("Open or closed"));
      // Exactly one closed message and one switch on the page.
      expect(screen.getAllByLabelText("Closed message")).toHaveLength(1);
      fireEvent.change(status.getByLabelText("Closed message"), { target: { value: "Full for now." } });
      fake.results = [null, [rsvp({ open: false, closed_message: "Full for now." })]];
      fireEvent.click(status.getByRole("switch", { name: /Open for answers/ }));
      expect(confirm).toHaveBeenCalled();
      await waitFor(() => expect(fake.calls[0]).toEqual(["setFormOpenFn", { id: "demo0001", open: false, message: "Full for now." }]));
    });

    it("your own form: saving questions after closing it keeps it closed (the editor never owns open/closed)", async () => {
      renderFormPage("demo0001", { "form-responses": [rsvp()] }, undefined, "questions");
      // Start an edit, then (unsaved) go close the form from Settings; the refetch says closed.
      fireEvent.change(within(screen.getByRole("form", { name: "Questions" })).getAllByLabelText("Question")[0], { target: { value: "Full name" } });
      fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
      fake.results = [null, [rsvp({ open: false, closed_message: "Full." })]];
      fireEvent.click(within(card("Open or closed")).getByRole("switch", { name: /Open for answers/ }));
      await waitFor(() => expect(within(card("Open or closed")).getByRole("switch", { name: /Open for answers/ })).toHaveProperty("checked", false));
      // Back on Questions the unsaved edit is still there; saving it must not reopen the form.
      fireEvent.click(screen.getByRole("tab", { name: "Questions" }));
      const editor = within(screen.getByRole("form", { name: "Questions" }));
      expect((editor.getAllByLabelText("Question")[0] as HTMLInputElement).value).toBe("Full name");
      fake.results = [{ id: "demo0001" }, [rsvp({ open: false, closed_message: "Full." })]];
      fireEvent.click(editor.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(fake.calls.at(-2)).toEqual(["saveAdminFormFn", expect.objectContaining({ id: "demo0001", open: false, closed_message: "Full." })]));
    });

    it("your own form: the question editor sends the questions with their keys and choice values kept", async () => {
      renderFormPage("demo0001", { "form-responses": [rsvp({ intro: "Hi", thanks: "Bye", one_per_email: true, version: 2 })] }, undefined, "questions");
      const editor = within(screen.getByRole("form", { name: "Questions" }));
      expect(editor.queryByLabelText(/^Key/)).toBeNull();
      const save = editor.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      // Rename the form in place, reorder, rename a choice, add one (Enter in a choice adds the next), and add a question.
      fireEvent.change(editor.getByLabelText("Form name"), { target: { value: "Salon RSVP" } });
      fireEvent.click(editor.getByRole("button", { name: "Move question 2 up" }));
      fireEvent.change(editor.getByLabelText("Question 1, choice 1"), { target: { value: "Yes, see you there" } });
      fireEvent.keyDown(editor.getByLabelText("Question 1, choice 2"), { key: "Enter" });
      expect(document.activeElement).toBe(editor.getByLabelText("Question 1, choice 3"));
      fireEvent.change(editor.getByLabelText("Question 1, choice 3"), { target: { value: "Maybe" } });
      fireEvent.click(editor.getByRole("button", { name: "Add question" }));
      expect(document.activeElement).toBe(editor.getAllByLabelText("Question")[2]);
      fireEvent.change(editor.getAllByLabelText("Question")[2], { target: { value: "Anything else?" } });
      expect(editor.getByRole("status").textContent).toBe("Unsaved changes");
      fake.results = [{ id: "demo0001" }, []];
      fireEvent.click(save);
      await waitFor(() => expect(fake.calls[0]?.[0]).toBe("saveAdminFormFn"));
      const sent = fake.calls[0][1] as { questions: { key: string; label: string; choices?: { value: string; label: string }[] }[] } & Record<string, unknown>;
      expect(sent).toMatchObject({ id: "demo0001", name: "Salon RSVP", slug: "salon-rsvp", intro: "Hi", thanks: "Bye", one_per_email: true, open: true });
      expect(sent.questions.map((q) => q.key).slice(0, 2)).toEqual(["coming", "name"]);
      expect(sent.questions[0].choices).toEqual([{ value: "yes", label: "Yes, see you there" }, { value: "no", label: "No" }, { value: "maybe", label: "Maybe" }]);
      expect(sent.questions[2]).toMatchObject({ label: "Anything else?", type: "short" });
      expect(sent.questions[2].key).toMatch(/^q_[a-z0-9]{6}$/);
    });

    it("your own form: Remove asks before dropping a question with words in it", () => {
      renderFormPage("demo0001", { "form-responses": [rsvp()] }, undefined, "questions");
      const editor = within(screen.getByRole("form", { name: "Questions" }));
      confirm.mockReturnValueOnce(false);
      fireEvent.click(editor.getByRole("button", { name: "Remove question 2" }));
      expect(editor.getAllByLabelText("Question")).toHaveLength(2);
      fireEvent.click(editor.getByRole("button", { name: "Remove question 2" }));
      expect(editor.getAllByLabelText("Question")).toHaveLength(1);
      fireEvent.click(editor.getByRole("button", { name: "Discard changes" }));
      expect(editor.getAllByLabelText("Question")).toHaveLength(2);
    });

    it("your own form: Link saves the address and one-per-email, nothing else", async () => {
      renderFormPage("demo0001", { "form-responses": [rsvp({ open: false, closed_message: "Shut.", intro: "Hi" })] }, undefined, "settings");
      const details = within(screen.getByRole("form", { name: "Link" }));
      fireEvent.change(details.getByLabelText("Web address"), { target: { value: "salon" } });
      expect(details.getByText(/The old link, \/f\/salon-rsvp, will keep working/)).toBeTruthy();
      fireEvent.click(details.getByRole("switch", { name: /One answer per email/ }));
      fake.results = [{ id: "demo0001" }, []];
      fireEvent.click(details.getByRole("button", { name: "Save link" }));
      await waitFor(() => expect(fake.calls[0]).toEqual(["saveAdminFormFn", expect.objectContaining({
        id: "demo0001", name: "Salon RSVP (demo)", slug: "salon", one_per_email: true, open: false, closed_message: "Shut.", intro: "Hi",
      })]));
    });

    it("your own form: Schedule saves its times as UTC and its limit as a number, keeping everything else", async () => {
      renderFormPage("demo0001", { "form-responses": [rsvp({ open: false, closed_message: "Shut.", total: 3 })] }, undefined, "settings");
      const schedule = within(screen.getByRole("form", { name: "Schedule and limit" }));
      expect(schedule.getByText(/it has 3 now/)).toBeTruthy();
      fireEvent.change(schedule.getByLabelText("Opens"), { target: { value: "2027-01-05T18:30" } });
      fireEvent.change(schedule.getByLabelText("Answer limit"), { target: { value: "40" } });
      fake.results = [{ id: "demo0001" }, []];
      fireEvent.click(schedule.getByRole("button", { name: "Save schedule" }));
      await waitFor(() => expect(fake.calls[0]).toEqual(["saveAdminFormFn", expect.objectContaining({
        id: "demo0001", open: false, closed_message: "Shut.", opens_at: new Date("2027-01-05T18:30").toISOString(), closes_at: null, max_responses: 40,
      })]));
    });

    it("your own form: a scheduled or full form says so on its ticket, and Link saves the confirmation switch", async () => {
      renderFormPage("demo0001", { "form-responses": [rsvp({ state: "full", max_responses: 2, total: 2 })] }, undefined, "settings");
      expect(screen.getByText(/all the answers its limit allows/)).toBeTruthy();
      const details = within(screen.getByRole("form", { name: "Link" }));
      expect(details.getByText(/Add an email question on the Questions tab first/)).toBeTruthy();
      fireEvent.click(details.getByRole("switch", { name: /Email a confirmation/ }));
      fake.results = [{ id: "demo0001" }, []];
      fireEvent.click(details.getByRole("button", { name: "Save link" }));
      await waitFor(() => expect(fake.calls[0]).toEqual(["saveAdminFormFn", expect.objectContaining({ confirm: true, max_responses: 2 })]));
    });

    it("your own form: Download CSV asks the server for that form's export", async () => {
      renderFormPage("demo0001", { "form-responses": [demoForm({ total: 2, newest_at: "2026-11-09T15:00:00Z" })] });
      fake.results = [{ filename: "salon-rsvp-responses-2026-11-09.csv", csv: "\uFEFF\"Received (UTC)\"\r\n" }];
      const createObjectURL = vi.fn(() => "blob:csv");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      fireEvent.click(within(card("Answers")).getByRole("button", { name: "Download CSV" }));
      await waitFor(() => expect(fake.calls).toEqual([["formResponsesCsvFn", { id: "demo0001" }]]));
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      click.mockRestore();
      vi.unstubAllGlobals();
    });
  });

  it("forms list: New form creates a closed form with name and email questions", async () => {
    renderForms({ "form-responses": [] });
    const yours = within(card("Your forms"));
    fireEvent.click(yours.getByRole("button", { name: "New form" }));
    const add = yours.getByRole("form", { name: "New form" });
    fireEvent.change(within(add).getByLabelText("Name"), { target: { value: "Coffee chat" } });
    fake.results = [{ id: "abcd1234" }, []];
    fireEvent.click(within(add).getByRole("button", { name: "Create form" }));
    await waitFor(() => expect(fake.calls[0]?.[0]).toBe("saveAdminFormFn"));
    expect(fake.calls[0]?.[1]).toMatchObject({
      name: "Coffee chat", slug: "coffee-chat", open: false, one_per_email: false,
      questions: [
        { key: "name", type: "short", label: "Your name", required: true },
        { key: "email", type: "email", label: "Email", required: true },
      ],
    });
    // Made: the panel folds away (and the page moves on to the new form's Questions tab).
    await waitFor(() => expect(yours.queryByRole("form", { name: "New form" })).toBeNull());
  });

  it("forms list: Duplicate copies a form's words, questions and settings, closed and unscheduled", async () => {
    const questions = [{ key: "q1", type: "long", label: "Dietary needs", required: false }];
    renderForms({ "form-responses": [demoForm({
      total: 3, intro: "Join us.", thanks: "See you.", closed_message: "Full up.", one_per_email: true, confirm: true,
      max_responses: 40, opens_at: "2026-01-01T00:00:00.000Z", closes_at: "2026-02-01T00:00:00.000Z", questions,
    })] });
    const yours = within(card("Your forms"));
    fireEvent.click(yours.getByRole("button", { name: "Duplicate Salon RSVP (demo)" }));
    const copy = yours.getByRole("form", { name: "Duplicate Salon RSVP (demo)" });
    expect((within(copy).getByLabelText("Name") as HTMLInputElement).value).toBe("Salon RSVP (demo) (copy)");
    expect((within(copy).getByLabelText("Web address") as HTMLInputElement).value).toBe("salon-rsvp-demo-copy");
    fake.reset();
    fake.results = [{ id: "abcd1234" }, []];
    fireEvent.click(within(copy).getByRole("button", { name: "Duplicate form" }));
    await waitFor(() => expect(fake.calls[0]?.[0]).toBe("saveAdminFormFn"));
    const sent = fake.calls[0]?.[1] as Record<string, unknown>;
    expect(sent).toMatchObject({
      name: "Salon RSVP (demo) (copy)", slug: "salon-rsvp-demo-copy", open: false, intro: "Join us.", thanks: "See you.",
      closed_message: "Full up.", one_per_email: true, confirm: true, max_responses: 40, questions,
    });
    expect(sent.id).toBeUndefined();
    expect(sent.opens_at).toBeUndefined();
    expect(sent.closes_at).toBeUndefined();
  });

  it("forms list: a built-in form duplicates into a closed custom form with its questions", async () => {
    renderForms({ "form-responses": [] });
    const builtIn = within(card("Built-in forms"));
    expect(builtIn.getAllByRole("button", { name: /^Duplicate/ })).toHaveLength(4);
    fireEvent.click(builtIn.getByRole("button", { name: "Duplicate Contact" }));
    const copy = within(card("Your forms")).getByRole("form", { name: "Duplicate Contact" });
    expect(document.activeElement).toBe(within(copy).getByLabelText("Name"));
    expect((within(copy).getByLabelText("Web address") as HTMLInputElement).value).toBe("contact-copy");
    fake.reset();
    fake.results = [{ id: "abcd1234" }, []];
    fireEvent.click(within(copy).getByRole("button", { name: "Duplicate form" }));
    await waitFor(() => expect(fake.calls[0]?.[0]).toBe("saveAdminFormFn"));
    const sent = fake.calls[0]?.[1] as { open: boolean; name: string; thanks: string; questions: { key: string }[] };
    expect(sent).toMatchObject({ name: "Contact (copy)", open: false, thanks: "Thanks for reaching out." });
    expect(sent.questions.map((q) => q.key)).toEqual(["name", "email", "topic", "message"]);
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

});
