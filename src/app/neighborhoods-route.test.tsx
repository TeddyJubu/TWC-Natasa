// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import type { MemberProfile } from "@/index";
import { NEIGHBORHOOD_SEED, type Neighborhood } from "@/features/neighborhoods/queries";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

vi.mock("@/features/neighborhoods/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route as IndexRoute } from "@/routes/neighborhoods";
import { Route as SlugRoute } from "@/routes/neighborhoods_.$slug";

const SlugPage = SlugRoute.options.component as React.ComponentType;
type Loader = (ctx: unknown) => Promise<unknown>;
const runLoader = (route: { options: { loader?: unknown } }, slug?: string) =>
  (route.options.loader as Loader)({ context: { queryClient: new QueryClient() }, params: { slug } });
const withLoaderData = (route: typeof IndexRoute | typeof SlugRoute, data: unknown) =>
  vi.spyOn(route, "useLoaderData").mockReturnValue(data as never);

afterEach(() => {
  cleanup();
  fake.reset();
  vi.restoreAllMocks();
});
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

const astoria = NEIGHBORHOOD_SEED.find((n) => n.slug === "astoria")!;
const woodside: Neighborhood = { slug: "woodside", name: "Woodside", color: "#1d3b6e", logoUrl: null, active: true };
const card = (name: string, neighborhood: string, image?: string): MemberProfile => ({
  id: `catalogue-${name}`, name, role: "Founder", business: `${name} Co`, neighborhood, specialty: "", bio: "", lookingFor: "",
  image, imageAlt: image ? `Portrait of ${name}` : undefined,
});

// The canvas's constellations page took over the list (owner decision, 2026-11-26); each neighborhood keeps its page.
describe("/neighborhoods", () => {
  it("moves permanently to /constellations", () => {
    let thrown: unknown;
    try { (IndexRoute.options.beforeLoad as () => void)(); } catch (e) { thrown = e; }
    expect(thrown).toMatchObject({ options: { to: "/constellations", statusCode: 301 } });
  });
});

describe("/neighborhoods/:slug loader", () => {
  it("returns the active neighborhood for its slug and no member data for the server's HTML", async () => {
    fake.results.push(NEIGHBORHOOD_SEED);
    expect(await runLoader(SlugRoute, "astoria")).toEqual({ hood: astoria });
    expect(fake.calls).toEqual([["neighborhoodsFn"]]);
  });

  it.each([
    ["an unknown slug", "nowhere", NEIGHBORHOOD_SEED],
    ["an inactive neighborhood", "astoria", [{ ...astoria, active: false }]],
  ])("404s for %s", async (_, slug, list) => {
    fake.results.push(list);
    const error = await runLoader(SlugRoute, slug).catch((e: unknown) => e);
    expect(isNotFound(error)).toBe(true);
  });
});

describe("/neighborhoods/:slug head", () => {
  type Head = { meta: Record<string, string>[]; links: Record<string, string>[]; scripts: { type: string; children: string }[] };
  const head = (loaderData?: unknown) => (SlugRoute.options.head as unknown as (ctx: { loaderData?: unknown }) => Head)({ loaderData });

  it("has an absolute canonical, og:url and a Home > Neighborhoods > name breadcrumb when VITE_SITE_URL is set", () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com");
    try {
      const { meta, links, scripts } = head({ hood: astoria });
      expect(links).toEqual([{ rel: "canonical", href: "https://example.com/neighborhoods/astoria" }]);
      expect(meta.find((m) => m.property === "og:url")?.content).toBe("https://example.com/neighborhoods/astoria");
      expect(scripts).toHaveLength(1);
      const ld = JSON.parse(scripts[0].children);
      expect(ld["@type"]).toBe("BreadcrumbList");
      expect(ld.itemListElement.map((i: { name: string; item: string }) => [i.name, i.item])).toEqual([
        ["Home", "https://example.com/"],
        ["Neighborhoods", "https://example.com/neighborhoods"],
        ["Astoria", "https://example.com/neighborhoods/astoria"],
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("has neither without a site URL", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    try {
      const { meta, links, scripts } = head({ hood: astoria });
      expect(links).toEqual([]);
      expect(scripts).toEqual([]);
      expect(meta.find((m) => m.property === "og:url")).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("/neighborhoods/:slug", () => {
  const visitor = [["viewer"], { signedIn: false, member: false, admin: false }] as [unknown[], unknown];
  const member = [["viewer"], { signedIn: true, member: true, admin: false }] as [unknown[], unknown];

  it("shows visitors no member section and loads no member data", async () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [visitor]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Astoria");
    expect(screen.queryByRole("heading", { name: /Women building in/ })).toBeNull();
    expect(within(screen.getByRole("main")).queryByRole("link", { name: /directory/i })).toBeNull(); // the header links it for everyone
    expectNoSkippedHeadings();
    await settle();
    // Never the members-only directory, and no gatherings call for a visitor.
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
    expect(fake.calls.some(([name]) => name === "eventsFn")).toBe(false);
    expect(screen.getByRole("link", { name: /across the collective/ }).getAttribute("href")).toBe("/events");
  });

  it("shows the server's HTML (viewer unknown) no member section", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    fake.results = [new Promise(() => {})]; // the viewer never settles
    renderWithQueries(<SlugPage />);
    expect(screen.queryByRole("heading", { name: /Women building in/ })).toBeNull();
  });

  it("shows members only that neighborhood's listed members, with initials when there is no portrait", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [member, [["directory"], [card("Rosa Diaz", "Astoria", "/rosa.jpg"), card("Camille Durand", "Astoria"), card("Lena Ortiz", "Sunnyside", "/l.jpg")]], [["events"], []]]);
    expect(screen.getByRole("button", { name: "View Rosa Diaz’s profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Camille Durand’s profile" }).textContent).toContain("CD");
    expect(screen.queryByText("Lena Ortiz")).toBeNull();
    expect(screen.getByRole("link", { name: /See them in the directory/ }).getAttribute("href")).toBe("/directory");
    expectNoSkippedHeadings();
  });

  it("opens a member in the dialog, linked to her full page", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [member, [["directory"], [{ ...card("Rosa Diaz", "Astoria"), catalogueNumber: 12 }]], [["events"], []]]);
    fireEvent.click(screen.getByRole("button", { name: "View Rosa Diaz’s profile" }));
    expect(screen.getByRole("dialog", { name: /Rosa Diaz/ }).textContent).toContain("Rosa Diaz");
    expect(screen.getByRole("link", { name: /Open full page/ }).getAttribute("href")).toBe("/members/rosa-diaz-12");
  });

  it("has an empty state for members when no one from the neighborhood is listed", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [member, [["directory"], [card("Lena Ortiz", "Sunnyside")]], [["events"], []]]);
    expect(screen.getByText(/No one from Astoria is listed in the directory yet/)).toBeTruthy();
  });

  it("uses the bundled photo for a seed neighborhood and a color tile for one without a photo", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    const { unmount } = renderWithQueries(<SlugPage />, [visitor]);
    // The hero photo is the page's largest paint: fetched first, never lazy.
    expect(screen.getByAltText("Astoria, Queens").getAttribute("fetchpriority")).toBe("high");
    expect(screen.getByAltText("Astoria, Queens").hasAttribute("loading")).toBe(false);
    unmount();
    withLoaderData(SlugRoute, { hood: woodside });
    renderWithQueries(<SlugPage />, [visitor]);
    expect(screen.queryByAltText(/Woodside/)).toBeNull();
    expect(screen.getByRole("region", { name: "Woodside" }).className).toContain("bg-(--hood)");
  });

  it("keeps the hero card's small text on paper where the color can't reach 4.5:1 (Sunnyside)", () => {
    const sunnyside = NEIGHBORHOOD_SEED.find((n) => n.slug === "sunnyside")!;
    withLoaderData(SlugRoute, { hood: sunnyside });
    renderWithQueries(<SlugPage />, [visitor]);
    const cardOf = (name: string) => screen.getByRole("heading", { level: 1, name }).parentElement!.className;
    expect(cardOf("Sunnyside")).toContain("bg-sb-paper");
    cleanup();
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [visitor]);
    expect(cardOf("Astoria")).toContain("bg-(--hood)");
  });

  it("shows members the neighborhood's own upcoming gatherings", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [
      [["viewer"], { signedIn: true, member: true, admin: false }],
      [["directory"], []],
      [["events"], [
        { id: "e1", title: "Headshot Session Day", description: "", location: "Studio on 31st Street", neighborhood: "Astoria", starts_at: "2026-11-20T23:00:00Z", kind: "event" },
        { id: "e2", title: "Sunnyside supper", description: "", location: "", neighborhood: "Sunnyside", starts_at: "2026-11-21T23:00:00Z", kind: "event" },
      ]],
    ]);
    expect(screen.getByText("Headshot Session Day")).toBeTruthy();
    expect(screen.getByText("Studio on 31st Street")).toBeTruthy();
    expect(screen.queryByText("Sunnyside supper")).toBeNull();
  });

  it("tells members when the neighborhood calendar is empty", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [[["viewer"], { signedIn: true, member: true, admin: false }], [["directory"], []], [["events"], []]]);
    expect(screen.getByText(/Nothing on the Astoria calendar yet/)).toBeTruthy();
  });
});
