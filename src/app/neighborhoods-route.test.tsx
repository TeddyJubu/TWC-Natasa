// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import type { MemberProfile } from "@/index";
import { NEIGHBORHOOD_SEED, type Neighborhood } from "@/features/neighborhoods/queries";
import { renderWithQueries, stubDialog } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

vi.mock("@/features/neighborhoods/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route as IndexRoute } from "@/routes/neighborhoods";
import { Route as SlugRoute } from "@/routes/neighborhoods_.$slug";

const IndexPage = IndexRoute.options.component as React.ComponentType;
const SlugPage = SlugRoute.options.component as React.ComponentType;
type Loader = (ctx: unknown) => Promise<unknown>;
const runLoader = (route: { options: { loader?: unknown } }, slug?: string) =>
  (route.options.loader as Loader)({ context: { queryClient: new QueryClient() }, params: { slug } });
const withLoaderData = (route: typeof IndexRoute | typeof SlugRoute, data: unknown) =>
  vi.spyOn(route, "useLoaderData").mockReturnValue(data as never);

let restoreDialog: (() => void) | undefined;
afterEach(() => {
  cleanup();
  fake.reset();
  vi.restoreAllMocks();
  restoreDialog?.();
  restoreDialog = undefined;
});
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

const astoria = NEIGHBORHOOD_SEED.find((n) => n.slug === "astoria")!;
const woodside: Neighborhood = { slug: "woodside", name: "Woodside", color: "#1d3b6e", logoUrl: null, active: true };
const noColor: Neighborhood = { slug: "east-elmhurst", name: "East Elmhurst", color: "", logoUrl: null, active: true };
const card = (name: string, neighborhood: string, image?: string): MemberProfile => ({
  id: `catalogue-${name}`, name, role: "Founder", business: `${name} Co`, neighborhood, specialty: "", bio: "", lookingFor: "",
  image, imageAlt: image ? `Portrait of ${name}` : undefined,
});

describe("/neighborhoods loader", () => {
  it("lists only active neighborhoods, in the server's order", async () => {
    fake.results.push([{ ...astoria, active: false }, woodside, NEIGHBORHOOD_SEED[0]]);
    expect(await runLoader(IndexRoute)).toEqual([woodside, NEIGHBORHOOD_SEED[0]]);
  });

  it("falls back to the seed when the fetch fails", async () => {
    fake.results.push(new Error("down"));
    expect(await runLoader(IndexRoute)).toEqual(NEIGHBORHOOD_SEED);
  });
});

describe("/neighborhoods", () => {
  it("counts the neighborhoods from the data, links each tile and keeps the outline", () => {
    withLoaderData(IndexRoute, [...NEIGHBORHOOD_SEED, woodside]);
    renderWithQueries(<IndexPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Eight neighborhoods, one constellation.");
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("link", { name: /Woodside/ })).toBeTruthy();
    expectNoSkippedHeadings();
  });

  it("says one neighborhood, and drops the number when there are none", () => {
    withLoaderData(IndexRoute, [astoria]);
    const { unmount } = renderWithQueries(<IndexPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("One neighborhood, one constellation.");
    unmount();
    withLoaderData(IndexRoute, []);
    renderWithQueries(<IndexPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Our neighborhoods, one constellation.");
  });

  it("colors tiles only through --hood, picks paper text on dark colors, and gives a colorless one the cream dashed tile", () => {
    withLoaderData(IndexRoute, [astoria, woodside, noColor]);
    renderWithQueries(<IndexPage />);
    const tile = (name: string) => screen.getByRole("link", { name: new RegExp(name) });
    expect(tile("Astoria").getAttribute("style")).toContain("--hood: #ff9a1f");
    expect(tile("Astoria").className).toContain("bg-(--hood)");
    expect(tile("Astoria").className).toContain("text-sb-ink");
    expect(tile("Woodside").className).toContain("text-sb-paper");
    expect(tile("East Elmhurst").getAttribute("style")).toBeNull();
    expect(tile("East Elmhurst").className).toContain("bg-sb-cream");
    expect(tile("East Elmhurst").className).toContain("border-dashed");
  });

  it("a bundled logo loads a downscale for its 28px mark; an uploaded one has no srcset", () => {
    const uploaded = { ...woodside, logoUrl: "/media/neighborhood-logos/woodside.png" };
    withLoaderData(IndexRoute, [astoria, uploaded]);
    renderWithQueries(<IndexPage />);
    const mark = (name: string) => screen.getByRole("link", { name: new RegExp(name) }).querySelector("img")!;
    expect(mark("Astoria").getAttribute("srcset")).toMatch(/astoria-128\.webp 128w/);
    expect(mark("Astoria").getAttribute("sizes")).toBe("28px");
    expect(mark("Woodside").getAttribute("src")).toBe("/media/neighborhood-logos/woodside.png");
    expect(mark("Woodside").hasAttribute("srcset")).toBe(false);
  });
});

describe("/neighborhoods/:slug loader", () => {
  it("returns the active neighborhood for its slug, with the public cards for the server's HTML", async () => {
    const rosa = card("Rosa Diaz", "Astoria");
    fake.results.push(NEIGHBORHOOD_SEED, [rosa]);
    expect(await runLoader(SlugRoute, "astoria")).toEqual({ hood: astoria, profiles: [rosa] });
    expect(fake.calls).toEqual([["neighborhoodsFn"], ["publicProfilesFn"]]);
  });

  it("still returns the neighborhood when the public cards fail (the client loads them)", async () => {
    fake.results.push(NEIGHBORHOOD_SEED, new Error("down"));
    expect(await runLoader(SlugRoute, "astoria")).toEqual({ hood: astoria, profiles: undefined });
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

  it("shows only that neighborhood's public profiles, with initials when there is no portrait", async () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], [card("Rosa Diaz", "Astoria", "/rosa.jpg"), card("Camille Durand", "Astoria"), card("Lena Ortiz", "Sunnyside", "/l.jpg")]]]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Astoria");
    expect(screen.getByRole("button", { name: "View Rosa Diaz’s profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Camille Durand’s profile" }).textContent).toContain("CD");
    expect(screen.queryByText("Lena Ortiz")).toBeNull();
    expectNoSkippedHeadings();
    await settle();
    // Never the members-only directory, and no gatherings call for a visitor.
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
    expect(fake.calls.some(([name]) => name === "eventsFn")).toBe(false);
    expect(screen.getByRole("link", { name: /across Queens/ }).getAttribute("href")).toBe("/gatherings");
  });

  it("renders the loader's public cards without a client fetch (server-rendered)", async () => {
    withLoaderData(SlugRoute, { hood: astoria, profiles: [card("Rosa Diaz", "Astoria")] });
    fake.results = [new Promise(() => {})]; // the viewer never settles
    renderWithQueries(<SlugPage />);
    expect(screen.getByRole("button", { name: "View Rosa Diaz’s profile" })).toBeTruthy();
    expect(screen.queryByText(/Loading members/)).toBeNull();
  });

  it("opens a member in the dialog", () => {
    restoreDialog = stubDialog();
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], [card("Rosa Diaz", "Astoria")]]]);
    fireEvent.click(screen.getByRole("button", { name: "View Rosa Diaz’s profile" }));
    expect(document.querySelector("dialog[open]")?.textContent).toContain("Rosa Diaz");
  });

  it("links the open member to her full page, like /members", () => {
    restoreDialog = stubDialog();
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], [{ ...card("Rosa Diaz", "Astoria"), catalogueNumber: 12 }]]]);
    fireEvent.click(screen.getByRole("button", { name: "View Rosa Diaz’s profile" }));
    expect(screen.getByRole("link", { name: /Open full page/ }).getAttribute("href")).toBe("/members/rosa-diaz-12");
  });

  it("has an empty state when no one from the neighborhood is public", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], [card("Lena Ortiz", "Sunnyside")]]]);
    expect(screen.getByText(/No one from Astoria has shared a public profile yet/)).toBeTruthy();
  });

  it("uses the bundled photo for a seed neighborhood and a color tile for one without a photo", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    const { unmount } = renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], []]]);
    // The hero photo is the page's largest paint: fetched first, never lazy.
    expect(screen.getByAltText("Astoria, Queens").getAttribute("fetchpriority")).toBe("high");
    expect(screen.getByAltText("Astoria, Queens").hasAttribute("loading")).toBe(false);
    unmount();
    withLoaderData(SlugRoute, { hood: woodside });
    renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], []]]);
    expect(screen.queryByAltText(/Woodside/)).toBeNull();
    expect(screen.getByRole("region", { name: "Woodside" }).className).toContain("bg-(--hood)");
  });

  it("keeps the hero card's small text on paper where the color can't reach 4.5:1 (Sunnyside)", () => {
    const sunnyside = NEIGHBORHOOD_SEED.find((n) => n.slug === "sunnyside")!;
    withLoaderData(SlugRoute, { hood: sunnyside });
    renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], []]]);
    const cardOf = (name: string) => screen.getByRole("heading", { level: 1, name }).parentElement!.className;
    expect(cardOf("Sunnyside")).toContain("bg-sb-paper");
    cleanup();
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [visitor, [["public-profiles"], []]]);
    expect(cardOf("Astoria")).toContain("bg-(--hood)");
  });

  it("shows members the neighborhood's own upcoming gatherings", () => {
    withLoaderData(SlugRoute, { hood: astoria });
    renderWithQueries(<SlugPage />, [
      [["viewer"], { signedIn: true, member: true, admin: false }],
      [["public-profiles"], []],
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
    renderWithQueries(<SlugPage />, [[["viewer"], { signedIn: true, member: true, admin: false }], [["public-profiles"], []], [["events"], []]]);
    expect(screen.getByText(/Nothing on the Astoria calendar yet/)).toBeTruthy();
  });
});
