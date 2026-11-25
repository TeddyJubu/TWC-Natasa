// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, within } from "@testing-library/react";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";
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
    for (const a of screen.getAllByRole("link")) expect(a.getAttribute("href"), a.textContent ?? "").not.toMatch(/^\/(members|directory)(\/|$)/);
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

  it("the mission card sits in #mission and its Join us button goes to /join", () => {
    renderWithQueries(<Page />);
    const mission = screen.getByRole("heading", { name: "Our mission", level: 2 }).closest("#mission")!;
    expect(mission).not.toBeNull();
    expect(within(mission as HTMLElement).getByRole("link", { name: /^Join us/ }).getAttribute("href")).toBe("/join");
  });

  it("two constellation bands follow the opening: North Brooklyn (open, with its map) then Queens, as native details", () => {
    renderWithQueries(<Page />);
    const section = screen.getByRole("heading", { name: "Two constellations", level: 2 }).closest("section")!;
    expect(section.previousElementSibling).toBe(screen.getByRole("heading", { level: 1 }).closest("section"));
    const bands = [...section.querySelectorAll("details.twc-cband")] as HTMLDetailsElement[];
    expect(bands.map((d) => d.querySelector(".twc-cband__name")!.textContent)).toEqual(["North Brooklyn", "Queens"]);
    expect(bands.map((d) => d.open)).toEqual([true, false]);
    expect(within(bands[0]).getByRole("img").getAttribute("aria-label")).toMatch(/Newtown Creek/);
    expect(within(section).getByRole("link", { name: "Explore the neighborhoods" }).getAttribute("href")).toBe("/neighborhoods");
  });

  it("each band lists its area's active neighborhoods from the data, never an inactive or unknown one", () => {
    const hoods = [...NEIGHBORHOOD_SEED.slice(0, 2), { ...NEIGHBORHOOD_SEED[2], active: false }, { slug: "woodside", name: "Woodside", color: "#123456", logoUrl: null, active: true },
      { slug: "nowhere", name: "Nowhere", color: "#000000", logoUrl: null, active: true }, NEIGHBORHOOD_SEED[7]];
    renderWithQueries(<Page />, [[["neighborhoods"], hoods]]);
    const names = (label: string) => within(screen.getByRole("list", { name: label })).getAllByRole("listitem");
    expect(names("Queens neighborhoods").map((li) => li.textContent)).toEqual(["Long Island City", "Astoria", "Woodside"]);
    expect(names("North Brooklyn neighborhoods").map((li) => li.textContent)).toEqual(["Greenpoint"]);
    expect((names("Queens neighborhoods")[2].querySelector(".twc-dot") as HTMLElement).style.getPropertyValue("--hood")).toBe("#123456");
    expect(document.body.textContent).not.toContain("Nowhere");
  });

  it("What’s on shows up to three upcoming public events, each linking to its page", () => {
    const at = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const event = { uid: "u1", slug: "coffee", title: "Coffee morning", description: null, category: "Coffee", coverImageUrl: null, startTime: at, endTime: at,
      timeZone: "America/New_York", location: "Astoria", capacity: null, status: "SCHEDULED", host: { name: null, username: null }, goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [] };
    renderWithQueries(<Page />, [[["cal", "events", { tab: "upcoming", take: 3 }], { events: [event], total: 1, categories: [], host: null }]]);
    const section = screen.getByRole("heading", { name: "What’s on", level: 2 }).closest("section")!;
    expect(within(section).getByRole("heading", { name: /^Coffee morning/, level: 3 })).toBeTruthy();
    expect(within(section).getByRole("link", { name: /Details and RSVP/ }).getAttribute("href")).toBe("/events/coffee");
    expect(within(section).getByRole("link", { name: "See every event" }).getAttribute("href")).toBe("/events");
  });

  it("What’s on with no events (or Cal down) shows only the link to the calendar", () => {
    renderWithQueries(<Page />, [[["cal", "events", { tab: "upcoming", take: 3 }], { events: [], total: 0, categories: [], host: null }]]);
    const section = screen.getByRole("heading", { name: "What’s on", level: 2 }).closest("section")!;
    expect(section.querySelector(".twc-ev")).toBeNull();
    expect(within(section).getByRole("link", { name: "See every event" }).getAttribute("href")).toBe("/events");
  });

  it("FAQ: three questions, more on /faq, questions go to /contact", () => {
    renderWithQueries(<Page />);
    const faq = document.getElementById("faq")!;
    expect(faq.querySelectorAll("details")).toHaveLength(3);
    expect(within(faq).getByRole("link", { name: /More questions/ }).getAttribute("href")).toBe("/faq");
    expect(within(faq).getByRole("link", { name: /Ask us anything/ }).getAttribute("href")).toBe("/contact");
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
