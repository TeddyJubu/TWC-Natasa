// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, within } from "@testing-library/react";
import { demoMembers } from "@/showcase/demo-members";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/cal/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/index";

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
});

describe("/ (home) and the members-only directory", () => {
  it("loads no member data: no loader, no client fetch, no member section and no directory link", async () => {
    expect(Route.options.loader).toBeUndefined();
    renderWithQueries(<Page />);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
    expect(screen.queryByRole("heading", { name: "Women doing remarkable work nearby." })).toBeNull();
    expect(screen.queryByRole("link", { name: /member directory|meet the members/i })).toBeNull();
    // The header links Directory for everyone (owner decision, 2026-11-26); the page itself links no member.
    for (const a of within(screen.getByRole("main")).getAllByRole("link")) expect(a.getAttribute("href"), a.textContent ?? "").not.toMatch(/^\/(members|directory)(\/|$)/);
    for (const m of demoMembers) expect(screen.queryByAltText(new RegExp(m.name))).toBeNull();
  });
});

describe("/ (home) structure", () => {
  it("never skips a heading level, with one h1", () => {
    renderWithQueries(<Page />);
    expectNoSkippedHeadings();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("describes the collective as an Organization and WebSite, with absolute URLs and no guessed sameAs", () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com/");
    try {
      const { scripts } = (Route.options.head as () => { scripts: { type: string; children: string }[] })();
      expect(scripts).toHaveLength(1);
      expect(scripts[0].type).toBe("application/ld+json");
      const graph = JSON.parse(scripts[0].children)["@graph"];
      expect(graph.map((n: { "@type": string }) => n["@type"])).toEqual(["Organization", "WebSite"]);
      expect(graph[0]).toMatchObject({ name: "The Women’s Collective", url: "https://example.com/", logo: "https://example.com/apple-touch-icon.png" });
      expect(graph[0].sameAs).toBeUndefined();
      expect(graph[1].url).toBe("https://example.com/");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("has no structured data without a site URL", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    try {
      expect((Route.options.head as () => { scripts: unknown[] })().scripts).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("is indexable: no noindex", () => {
    const { meta } = (Route.options.head as () => { meta: Record<string, string>[] })();
    expect(meta.find((m) => m.name === "robots")).toBeUndefined();
  });

  it("the letter card sits in #letter and points to the application's opt-in with the one Join us button", () => {
    renderWithQueries(<Page />);
    const letter = screen.getByRole("heading", { name: "The Collective letter", level: 2 }).closest("#letter")!;
    expect(letter).not.toBeNull();
    expect(within(letter as HTMLElement).getByRole("link", { name: /^Join us/ }).getAttribute("href")).toBe("/join");
  });

  it("five constellation bands, as closed native details: the two live ones join, the others look for leads", () => {
    renderWithQueries(<Page />);
    const section = screen.getByRole("heading", { name: "Five constellations", level: 2 }).closest("section")!;
    const bands = [...section.querySelectorAll("details.twc-cband")] as HTMLDetailsElement[];
    expect(bands.map((d) => d.querySelector(".twc-cband__name")!.textContent)).toEqual(
      ["North Brooklyn", "Western Queens", "Brownstone Brooklyn", "Uptown Manhattan", "Downtown Manhattan"]);
    expect(bands.map((d) => d.querySelector(".twc-cband__st")!.textContent)).toEqual(
      ["Live · Founding 50", "Live", "Launching", "Ambassador wanted", "Ambassador wanted"]);
    expect(bands.every((d) => !d.open)).toBe(true);
    for (const d of bands.slice(0, 2)) expect(within(d).getByRole("link", { name: /^Join us/ }).getAttribute("href")).toBe("/join");
    for (const d of bands.slice(2)) expect(within(d).getByRole("link", { name: /Lead this constellation/ }).getAttribute("href")).toBe("/contact");
  });

  it("each band's star chart names its neighborhoods and never a member count", () => {
    const { container } = renderWithQueries(<Page />);
    const charts = [...container.querySelectorAll("svg.twc-starchart")];
    expect(charts.map((s) => s.getAttribute("aria-label"))[0]).toBe("North Brooklyn constellation: Greenpoint, Williamsburg, Bushwick");
    expect(charts).toHaveLength(5);
    for (const s of charts) expect(s.textContent).not.toMatch(/member/i);
    // Live bands have no open seats; a band with no members yet shows them.
    expect(charts[0].textContent).not.toMatch(/open seat|Your star here/);
    expect(charts[4].textContent).toMatch(/Your star here/);
  });

  it("seven experience tiles link to the calendar, with five captioned photos between them", () => {
    const { container } = renderWithQueries(<Page />);
    const grid = container.querySelector(".twc-grid6")!;
    const tiles = [...grid.querySelectorAll("a.twc-tile")];
    expect(tiles.map((a) => a.querySelector("h3")!.textContent)).toEqual(["Constellation Zooms", "Coffee Connections", "Constellation Meetups",
      "Expert Panels", "Hands-on Workshops", "Incubator Growth Sessions", "Happy Hours"]);
    for (const a of tiles) expect(a.getAttribute("href")).toBe("/events");
    expect(grid.querySelectorAll("figure.twc-tile--photo img")).toHaveLength(5);
    expect(grid.children).toHaveLength(12);
  });

  it("the program shows up to five upcoming public events, titled by the first one's month, each linking to its page", () => {
    const at = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const event = { uid: "u1", slug: "coffee", title: "Coffee morning", description: null, category: "Coffee", coverImageUrl: null, startTime: at, endTime: at,
      timeZone: "America/New_York", location: "Astoria", capacity: null, status: "SCHEDULED", host: { name: null, username: null }, goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [] };
    renderWithQueries(<Page />, [[["cal", "events", { tab: "upcoming", take: 5 }], { events: [event], total: 1, categories: [], host: null }]]);
    const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "America/New_York" }).format(new Date(at));
    const section = screen.getByRole("heading", { name: `Program, ${month}`, level: 2 }).closest("section")!;
    expect(within(section).getByRole("heading", { name: /^Coffee morning/, level: 3 })).toBeTruthy();
    expect(within(section).getByRole("link", { name: /Details and RSVP/ }).getAttribute("href")).toBe("/events/coffee");
  });

  it("the program with no events (or Cal down) says dates come as they're announced and links the calendar", () => {
    renderWithQueries(<Page />, [[["cal", "events", { tab: "upcoming", take: 5 }], { events: [], total: 0, categories: [], host: null }]]);
    const section = screen.getByRole("heading", { name: "Program", level: 2 }).closest("section")!;
    expect(section.querySelector(".twc-ev")).toBeNull();
    expect(within(section).getByRole("link", { name: "See the calendar" }).getAttribute("href")).toBe("/events");
  });

  it("lead or partner: ambassadors write through /contact, partners see /partnerships, with no partner prices", () => {
    renderWithQueries(<Page />);
    expect(screen.getByRole("link", { name: /Become an ambassador/ }).getAttribute("href")).toBe("/contact");
    expect(screen.getByRole("link", { name: /Ways to partner/ }).getAttribute("href")).toBe("/partnerships");
    expect(screen.getByRole("link", { name: /See packages/ }).getAttribute("href")).toBe("/partnerships");
  });

  it("never says gathering (the word is events) and names no member beyond the founder", () => {
    const { container } = renderWithQueries(<Page />);
    expect(container.textContent).not.toMatch(/gathering/i);
    expect(container.textContent).not.toMatch(/Shauna/);
  });

  it("drops the old decorations: no scallop, ribbon, polaroid, stamp, ticket or retired script face, and nothing loops", () => {
    const { container } = renderWithQueries(<Page />);
    expect(container.querySelector(".twc-scallop, .sb-ribbon, .twc-ribbon, .twc-polaroid, .sb-stamp, .twc-stamp, .twc-ticket, .font-script, .font-fragment, .sb-write, .animate-marquee")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pause/ })).toBeNull();
  });

  it("shows no price: membership pricing is undecided", () => {
    const { container } = renderWithQueries(<Page />);
    expect(container.textContent).not.toMatch(/\$\d|per (month|year)|\bfree\b/i);
  });
});
