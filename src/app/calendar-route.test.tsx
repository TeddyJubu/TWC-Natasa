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

  it("keeps only a real month from the address", () => {
    const parse = Route.options.validateSearch as (raw: Record<string, unknown>) => { month?: string };
    expect(parse({ month: "2026-12" })).toEqual({ month: "2026-12" });
    expect(parse({ month: "2026-13" })).toEqual({});
    expect(parse({ month: "<script>" })).toEqual({});
  });
});
