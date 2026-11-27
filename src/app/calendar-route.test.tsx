// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

vi.mock("@/features/cal/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route } from "@/routes/_authenticated/calendar";
import type { CalEvent } from "@/features/cal/types";

const event = (uid: string, title: string, startTime: string): CalEvent => ({
  uid, slug: uid, title, description: null, category: "Coffee", coverImageUrl: null, startTime, endTime: startTime,
  timeZone: "America/New_York", location: "Astoria", capacity: null, status: "SCHEDULED", host: { name: "Host", username: "twc" },
  goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [],
});

vi.spyOn(Route, "useRouteContext").mockReturnValue({ user: { id: "u1", name: "Rosa", email: "u1@x.test" } } as never);
const navigate = vi.fn();
beforeEach(() => {
  vi.spyOn(Route, "useSearch").mockReturnValue({ month: "2026-12" } as never);
  vi.spyOn(Route, "useNavigate").mockReturnValue(navigate as never);
});
afterEach(() => { cleanup(); fake.reset(); navigate.mockClear(); });
const Page = Route.options.component as React.ComponentType;
const seed: [unknown[], unknown][] = [
  [["viewer"], { signedIn: true, member: true, admin: false }],
  [["profile", "u1"], { profile: { full_name: "Rosa", status: "approved", catalogue_number: 1 }, avatarUrl: undefined }],
  [["cal", "events", { tab: "all", month: "2026-12", take: 100 }], { events: [event("e1", "Coffee Connections", "2026-12-05T15:00:00.000Z")], total: 1, categories: ["Coffee"], host: "Host" }],
];

describe("/calendar", () => {
  it("stays out of search", () => {
    const meta = (Route.options.head as () => { meta: Record<string, string>[] })().meta;
    expect(meta).toContainEqual({ name: "robots", content: "noindex" });
  });

  it("names the month as its one h1, in the member frame, with the month's events in the grid and the program", () => {
    renderWithQueries(<Page />, seed);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["December, 2026"]);
    expect(within(screen.getByRole("navigation", { name: "Members" })).getByRole("link", { name: "Calendar" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link", { name: /Coffee Connections/ }).length).toBeGreaterThanOrEqual(2); // a day’s pill and its program row
  });

  it("names the month once: the grid's own title is only announced", () => {
    renderWithQueries(<Page />, seed);
    expect(screen.queryByRole("heading", { name: "December 2026" })).toBeNull();
    expect(screen.getAllByText(/December/).filter((n) => !n.closest(".sr-only") && n.tagName !== "TABLE")
      .map((n) => n.textContent)).toEqual(["December, 2026"]);
  });

  it("draws the neighbouring months' events on the grid's leading and trailing days", () => {
    const month = (m: string, events: CalEvent[]): [unknown[], unknown] =>
      [["cal", "events", { tab: "all", month: m, take: 100 }], { events, total: events.length, categories: ["Coffee"], host: "Host" }];
    renderWithQueries(<Page />, [
      ...seed,
      month("2026-11", [event("n1", "November coffee", "2026-11-30T15:00:00.000Z")]),
      month("2027-01", [event("j1", "January coffee", "2027-01-02T15:00:00.000Z")]),
    ]);
    const day = (d: string) => within(document.querySelector<HTMLElement>(`[data-day="${d}"]`)!);
    expect(day("2026-11-30").getByRole("link", { name: /November coffee/ })).toBeTruthy();
    expect(day("2027-01-02").getByRole("link", { name: /January coffee/ })).toBeTruthy();
    // The program under the grid stays the month's own.
    expect(screen.getAllByRole("link", { name: /November coffee/ })).toHaveLength(1);
  });

  it("with no month in the address opens on the next event's month when this one has nothing left", async () => {
    vi.spyOn(Route, "useSearch").mockReturnValue({} as never);
    const later = event("l1", "Spring coffee", "2027-03-10T15:00:00.000Z");
    renderWithQueries(<Page />, [
      ...seed,
      [["cal", "events", { tab: "upcoming", take: 1 }], { events: [later], total: 1, categories: ["Coffee"], host: "Host" }],
      [["cal", "events", { tab: "all", month: "2027-03", take: 100 }], { events: [later], total: 1, categories: ["Coffee"], host: "Host" }],
    ]);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("March, 2027");
    expect(within(document.querySelector<HTMLElement>('[data-day="2027-03-10"]')!).getByRole("link", { name: /Spring coffee/ })).toBeTruthy();
  });

  it("keeps only a real month from the address", () => {
    const parse = Route.options.validateSearch as (raw: Record<string, unknown>) => { month?: string };
    expect(parse({ month: "2026-12" })).toEqual({ month: "2026-12" });
    expect(parse({ month: "2026-13" })).toEqual({});
    expect(parse({ month: "<script>" })).toEqual({});
  });
});
