// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

vi.mock("@/features/cal/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route } from "@/routes/events";
import { parseGatheringsSearch, type GatheringsSearch } from "@/features/cal/event-state";
import type { CalEvent, EventList } from "@/features/cal/types";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const event = (uid: string, title: string, over: Partial<CalEvent> = {}): CalEvent => ({
  uid, slug: uid, title, description: null, category: "Supper", coverImageUrl: null, startTime: future(3), endTime: future(4),
  timeZone: "America/New_York", location: "Astoria", capacity: null, status: "SCHEDULED", host: { name: "Host", username: "twc" },
  goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [], ...over,
});
const page = (events: CalEvent[], total = events.length): EventList => ({ events, total, categories: ["Supper", "Coffee"], host: "Host" });

let search: GatheringsSearch;
let loaderData: EventList | undefined;
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

describe("/events", () => {
  it("is indexable, and marks up listed gatherings as Events, escaped", () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com");
    const head = (Route.options.head as (c: unknown) => { meta: Record<string, string>[]; scripts: { children: string }[] })({
      loaderData: page([event("e1", "Book club </script>")]),
    });
    vi.unstubAllEnvs();
    expect(head.meta).not.toContainEqual({ name: "robots", content: "noindex" });
    expect(head.scripts[0].children).not.toContain("<");
    const graph = JSON.parse(head.scripts[0].children)["@graph"];
    expect(graph[1]).toMatchObject({ "@type": "Event", name: "Book club </script>", url: "https://example.com/events/e1" });
  });

  it("renders the loader's gatherings with no client fetch", () => {
    loaderData = page([event("e1", "Supper club")]);
    renderPage();
    expect(screen.getByRole("link", { name: "Supper club" }).getAttribute("href")).toBe("/events/e1");
    expect(fake.calls).toEqual([]);
    expectNoSkippedHeadings();
  });

  it("keeps the filters in the URL and drops defaults", () => {
    expect(parseGatheringsSearch({ tab: "upcoming", view: "grid", month: "2026-13", q: "  ", category: "Coffee" })).toEqual({ category: "Coffee" });
    expect(parseGatheringsSearch({ tab: "past", view: "calendar", month: "2026-12", q: "brunch", business: "cafe" }))
      .toEqual({ tab: "past", view: "calendar", month: "2026-12", q: "brunch", business: "cafe" });
    loaderData = page([event("e1", "Supper club")]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    expect(lastSearch()).toEqual({ tab: "past" });
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(lastSearch()).toEqual({ view: "calendar" });
    fireEvent.click(screen.getByRole("button", { name: "Coffee" }));
    expect(lastSearch()).toEqual({ category: "Coffee" });
  });

  it("says when nothing is on the calendar", () => {
    loaderData = page([]);
    renderPage();
    expect(screen.getByText("No events on the calendar yet.")).toBeTruthy();
  });

  it("shows an outage with a retry instead of breaking", async () => {
    fake.results = [new Error("down")];
    renderPage();
    await settle();
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn’t load the calendar/);
    fake.results = [page([event("e1", "Back again")])];
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Back again" })).toBeTruthy();
  });

  it("loads more with the next offset", async () => {
    loaderData = page([event("e1", "First")], 2);
    renderPage();
    fake.results = [page([event("e2", "Second")], 2)];
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByRole("link", { name: "Second" })).toBeTruthy();
    expect(fake.calls[0][1]).toMatchObject({ skip: 1, take: 12, tab: "upcoming" });
  });
});
