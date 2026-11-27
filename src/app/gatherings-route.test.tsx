// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

vi.mock("@/features/cal/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route, type EventsLoad } from "@/routes/events";
import { parseGatheringsSearch, type GatheringsSearch } from "@/features/cal/event-state";
import type { CalEvent, EventList } from "@/features/cal/types";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const event = (uid: string, title: string, over: Partial<CalEvent> = {}): CalEvent => ({
  uid, slug: uid, title, description: null, category: "Supper", coverImageUrl: null, startTime: future(3), endTime: future(4),
  timeZone: "America/New_York", location: "Astoria", capacity: null, status: "SCHEDULED", host: { name: "Host", username: "twc" },
  goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [], ...over,
});
const page = (events: CalEvent[], total = events.length): EventList => ({ events, total, categories: ["Supper", "Coffee"], host: "Host" });
/** The usual list load: the next event (anything ahead?) and the first page. */
const listLoad = (events: CalEvent[], total = events.length): EventsLoad => ({ next: page(events.slice(0, 1), total), page: page(events, total) });

let search: GatheringsSearch;
let loaderData: EventsLoad | undefined;
const navigate = vi.fn();
beforeEach(() => {
  search = {};
  loaderData = undefined;
  navigate.mockClear();
  vi.spyOn(Route, "useSearch").mockImplementation(() => search as never);
  vi.spyOn(Route, "useLoaderData").mockImplementation(() => loaderData as never);
  vi.spyOn(Route, "useNavigate").mockImplementation(() => navigate as never);
});
afterEach(() => { cleanup(); fake.reset(); });
const Page = Route.options.component as React.ComponentType;
// The nav asks who is looking; a signed-out answer keeps these tests about the calendar's own fetches.
const renderPage = () => renderWithQueries(<Page />, [[["viewer"], { signedIn: false, member: false, admin: false }]]);
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));
const lastSearch = () => (navigate.mock.lastCall![0] as { search: (p: GatheringsSearch) => GatheringsSearch }).search(search);
const h1 = () => screen.getByRole("heading", { level: 1 });
/** The program head's side notes (the experience tiles further down have their own "new dates" line). */
const headMeta = () => [...document.querySelectorAll(".twc-shead .twc-meta")].map((p) => p.textContent).join(" ");
type Head = { meta: Record<string, string>[]; scripts: { children: string }[] };
const head = (data: EventsLoad) => (Route.options.head as (c: unknown) => Head)({ loaderData: data });
const monthOf = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", timeZone: "America/New_York" });

describe("/events", () => {
  it("is indexable, and marks up listed gatherings as Events, escaped", () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com");
    const list = head(listLoad([event("e1", "Book club </script>")]));
    const calendar = head({ month: "2027-03", months: { "2027-03": page([event("c1", "Coffee")]) } });
    vi.unstubAllEnvs();
    expect(list.meta).not.toContainEqual({ name: "robots", content: "noindex" });
    expect(list.scripts[0].children).not.toContain("<");
    const graph = JSON.parse(list.scripts[0].children)["@graph"];
    expect(graph[1]).toMatchObject({ "@type": "Event", name: "Book club </script>", url: "https://example.com/events/e1" });
    expect(JSON.parse(calendar.scripts[0].children)["@graph"][1]).toMatchObject({ name: "Coffee" });
  });

  it("opens on the program: its h1 names it, the first event comes before the experience tiles, with no client fetch", () => {
    loaderData = listLoad([event("e1", "Supper club")]);
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(h1().textContent).toBe(`Program, ${monthOf(future(3))}`);
    const row = screen.getByRole("link", { name: "Supper club" });
    expect(row.getAttribute("href")).toBe("/events/e1");
    // The tiles are a secondary section under the list, one level down.
    const tiles = screen.getByRole("heading", { level: 2, name: /Zooms/ });
    expect(row.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fake.calls).toEqual([]);
    expectNoSkippedHeadings();
  });

  it("keeps the filters in the URL and drops defaults; the view toggle reads List / Calendar", () => {
    expect(parseGatheringsSearch({ tab: "upcoming", view: "grid", month: "2026-13", q: "  ", category: "Coffee" })).toEqual({ category: "Coffee" });
    expect(parseGatheringsSearch({ tab: "past", view: "calendar", month: "2026-12", q: "brunch", business: "cafe" }))
      .toEqual({ tab: "past", view: "calendar", month: "2026-12", q: "brunch", business: "cafe" });
    loaderData = listLoad([event("e1", "Supper club")]);
    renderPage();
    const views = within(screen.getByRole("group", { name: "View as" }));
    expect(views.getAllByRole("button").map((b) => b.textContent)).toEqual(["List", "Calendar"]);
    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    expect(lastSearch()).toEqual({ tab: "past" });
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(lastSearch()).toEqual({ view: "calendar" });
    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    expect(lastSearch()).toEqual({ category: "Coffee" });
  });

  it("with nothing ahead keeps only the tabs, and offers the letter for the next date", () => {
    loaderData = { next: page([]), page: page([]) };
    renderPage();
    expect(screen.getByText("No events on the calendar yet.")).toBeTruthy();
    expect(screen.getByText("Get the letter and hear about the next date first.")).toBeTruthy();
    expect(screen.getByRole("form", { name: "Newsletter sign-up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Past" })).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("group", { name: "View as" })).toBeNull();
    expect(screen.queryByText("Browse by category")).toBeNull();
    expect(h1().textContent).toBe("Upcoming events");
    expectNoSkippedHeadings();
  });

  it("the past tab is headed Past events, never a month, and keeps its search", () => {
    search = { tab: "past" };
    loaderData = { next: page([]), page: page([event("p1", "Last spring", { startTime: future(-30), endTime: future(-29) })]) };
    renderPage();
    expect(h1().textContent).toBe("Past events");
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(headMeta()).not.toMatch(/New dates posted/);
  });

  it("a search says what it found, and an empty one can be cleared", () => {
    search = { q: "brunch", category: "Coffee" };
    loaderData = { next: page([event("e1", "Supper club")]), page: page([event("e2", "Brunch"), event("e3", "Brunch two")]) };
    const { unmount } = renderPage();
    expect(h1().textContent).toBe("Program");
    expect(headMeta()).toMatch(/Found\s*2 events/);
    expect(headMeta()).not.toMatch(/New dates posted/);
    unmount();
    loaderData = { next: page([event("e1", "Supper club")]), page: page([]) };
    renderPage();
    expect(screen.getByText("Nothing matches that.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(lastSearch()).toEqual({});
  });

  it("shows an outage with a retry instead of breaking", async () => {
    loaderData = { next: page([event("e1", "Supper club")]) };
    fake.results = [new Error("down")];
    renderPage();
    await settle();
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn’t load the calendar/);
    fake.results = [page([event("e1", "Back again")])];
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Back again" })).toBeTruthy();
  });

  it("loads more with the next offset", async () => {
    loaderData = listLoad([event("e1", "First")], 2);
    renderPage();
    fake.results = [page([event("e2", "Second")], 2)];
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByRole("link", { name: "Second" })).toBeTruthy();
    expect(fake.calls[0][1]).toMatchObject({ skip: 1, take: 12, tab: "upcoming" });
  });
});

describe("/events?view=calendar", () => {
  const march = event("m1", "March supper", { startTime: "2027-03-10T23:00:00.000Z", endTime: "2027-03-11T01:00:00.000Z" });
  const april = event("a1", "April coffee", { startTime: "2027-04-02T14:00:00.000Z", endTime: "2027-04-02T15:00:00.000Z" });

  it("with no month in the address opens where the next event is, loading the month and both neighbours", async () => {
    const queryClient = new QueryClient();
    fake.results = [page([march]), page([]), page([march]), page([april])];
    const load = Route.options.loader as (c: unknown) => Promise<EventsLoad>;
    const data = await load({ context: { queryClient }, deps: { view: "calendar" } });
    expect(data.month).toBe("2027-03");
    expect(Object.keys(data.months!).sort()).toEqual(["2027-02", "2027-03", "2027-04"]);
    expect(fake.calls.map((c) => (c[1] as { month?: string }).month)).toEqual([undefined, "2027-02", "2027-03", "2027-04"]);
  });

  it("names the shown month once, and draws the next month's events on the grid's trailing days", () => {
    search = { view: "calendar" };
    loaderData = { next: page([march]), month: "2027-03", months: { "2027-02": page([]), "2027-03": page([march]), "2027-04": page([april]) } };
    renderPage();
    expect(h1().textContent).toBe("Program, March");
    expect(screen.queryByRole("heading", { name: "March 2027" })).toBeNull();
    expect(within(document.querySelector<HTMLElement>('[data-day="2027-03-10"]')!).getByRole("link", { name: /March supper/ })).toBeTruthy();
    expect(within(document.querySelector<HTMLElement>('[data-day="2027-04-02"]')!).getByRole("link", { name: /April coffee/ })).toBeTruthy();
    expect(fake.calls).toEqual([]);
    expectNoSkippedHeadings();
  });
});
