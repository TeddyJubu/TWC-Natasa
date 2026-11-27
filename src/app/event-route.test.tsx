// @vitest-environment jsdom
// One event's page (/events/<slug>): its schema.org Event for search, who is looking asked in the loader (so the
// server's HTML holds the right RSVP panel), and the place linked to a map search.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

vi.mock("@/features/cal/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route, type EventPageData } from "@/routes/events_.$slug";
import type { CalEventDetail } from "@/features/cal/types";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const detail = (over: Partial<CalEventDetail> = {}): CalEventDetail => ({
  uid: "e1", slug: "supper", title: "Supper club", description: "Long table.", category: "Supper", coverImageUrl: null, startTime: future(3),
  endTime: future(4), timeZone: "America/New_York", location: "Sunnyside Bakery, 41-10 Queens Blvd", capacity: 10, status: "SCHEDULED",
  host: { name: "Host", username: "twc" }, goingCount: 1, maybeCount: 0, spotsLeft: 9, attendees: [], unlisted: false, ...over,
});
const signedOut = { signedIn: false, member: false, admin: false, declined: false };

let loaderData: EventPageData;
beforeEach(() => {
  vi.spyOn(Route, "useParams").mockImplementation(() => ({ slug: "supper" }) as never);
  vi.spyOn(Route, "useSearch").mockImplementation(() => ({}) as never);
  vi.spyOn(Route, "useLoaderData").mockImplementation(() => loaderData as never);
});
afterEach(() => { cleanup(); fake.reset(); vi.unstubAllEnvs(); });
const Page = Route.options.component as React.ComponentType;
type Head = { meta: Record<string, string>[]; scripts?: { children: string }[] };
const head = (data: EventPageData) => (Route.options.head as (c: unknown) => Head)({ loaderData: data, params: { slug: "supper" } });

describe("/events/<slug>", () => {
  it("marks up a listed event as a schema.org Event, escaped, and never an unlisted one", () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com");
    const listed = head({ event: detail({ title: "Supper </script>" }), viewer: null });
    expect(listed.scripts![0].children).not.toContain("<");
    const graph = JSON.parse(listed.scripts![0].children)["@graph"];
    expect(graph[1]).toMatchObject({ "@type": "Event", name: "Supper </script>", url: "https://example.com/events/supper", eventStatus: "https://schema.org/EventScheduled" });
    const hidden = head({ event: detail({ unlisted: true }), viewer: null });
    expect(hidden.scripts ?? []).toEqual([]);
    expect(hidden.meta).toContainEqual({ name: "robots", content: "noindex" });
  });

  it("asks who is looking in the loader, and a failed check is the guest form, not a broken page", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["cal", "event", "supper", null], detail());
    fake.results = [{ signedIn: true, member: true, admin: false, declined: false }];
    const load = Route.options.loader as (c: unknown) => Promise<EventPageData>;
    const data = await load({ context: { queryClient }, params: { slug: "supper" }, deps: {} });
    expect(data.viewer).toMatchObject({ member: true });
    expect(data.event?.uid).toBe("e1");
    const failing = new QueryClient();
    failing.setQueryData(["cal", "event", "supper", null], detail());
    fake.results = [new Error("down")];
    expect((await load({ context: { queryClient: failing }, params: { slug: "supper" }, deps: {} })).viewer).toBeNull();
  });

  it("renders the loader's panel at once: a signed-out visitor gets the form and the members' way in, no Loading…", () => {
    loaderData = { event: detail(), viewer: signedOut };
    renderWithQueries(<Page />);
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(screen.getByLabelText(/Your name/)).toBeTruthy();
    const panel = within(screen.getByRole("complementary", { name: "Are you coming?" }));
    expect(panel.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/auth");
  });

  it("links a physical place to a map search in a new tab", () => {
    loaderData = { event: detail(), viewer: signedOut };
    renderWithQueries(<Page />);
    const map = screen.getByRole("link", { name: /Sunnyside Bakery.*\(opens map\)/ });
    expect(map.getAttribute("href")).toBe("https://www.google.com/maps/search/?api=1&query=Sunnyside%20Bakery%2C%2041-10%20Queens%20Blvd");
    expect(map.getAttribute("target")).toBe("_blank");
    expect(map.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("leaves an online place as text, and a web address is its own link", () => {
    loaderData = { event: detail({ location: "Zoom" }), viewer: signedOut };
    const { unmount } = renderWithQueries(<Page />);
    expect(screen.getByText("Zoom").closest("a")).toBeNull();
    unmount();
    loaderData = { event: detail({ location: "https://example.org/room" }), viewer: signedOut };
    renderWithQueries(<Page />);
    const link = screen.getByRole("link", { name: /example\.org\/room/ });
    expect(link.getAttribute("href")).toBe("https://example.org/room");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
