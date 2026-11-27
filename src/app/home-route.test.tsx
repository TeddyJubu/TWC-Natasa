// @vitest-environment jsdom
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { RosterMember } from "@/features/roster/queries";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/cal/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/roster/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/index";

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
});

// Invented people: the real roster never enters this public repository (see the last test).
const person = (name: string, hood: string, constellation: RosterMember["constellation"], extra: Partial<RosterMember> = {}): RosterMember =>
  ({ name, hood, constellation, photo: `/media/roster/${name.toLowerCase().replace(/ /g, "-")}.webp`, ...extra });
const ROSTER = {
  members: [
    person("Ada Example", "Greenpoint", "NB", { role: "Potter", business: "Clay Co" }),
    person("Bea Sample", "Greenpoint", "NB"),
    person("Cy Placeholder", "Williamsburg", "NB", { role: "Florist" }),
    person("Dee Fixture", "Astoria", "WQ", { role: "Baker" }),
  ],
  leads: { WQ: "Eve Testcase" },
};
const withRoster = (roster: unknown) => [[["roster"], roster]] as [readonly unknown[], unknown][];
const bandsOf = (container: HTMLElement) => [...container.querySelectorAll<HTMLDetailsElement>("details.twc-cband")];
const subLabels = (svg: Element) => [...svg.querySelectorAll("text.sc-sub")].map((t) => t.textContent);

describe("/ (home): members come only from the roster", () => {
  it("has no loader, and asks only the roster for members (never the directory)", async () => {
    expect(Route.options.loader).toBeUndefined();
    renderWithQueries(<Page />);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fake.calls).toContainEqual(["rosterFn"]);
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
  });

  it("an empty roster: no member strip, open seats in every chart and two open profile cards per band", () => {
    const { container } = renderWithQueries(<Page />, withRoster({ members: [], leads: {} }));
    expect(container.querySelector(".twc-members")).toBeNull();
    expect(container.querySelectorAll(".sc-mem")).toHaveLength(0);
    for (const d of bandsOf(container)) {
      const svg = d.querySelector("svg.twc-starchart")!;
      expect(subLabels(svg).slice(0, -1).every((t) => t === "Your star here")).toBe(true);
      expect(svg.querySelectorAll(".sc-open path, path.sc-open")).toHaveLength(1);
      expect([...d.querySelectorAll(".twc-pf-card")].map((c) => c.classList.contains("is-open"))).toEqual([true, true]);
      expect(within(d).queryAllByRole("img", { name: /Example|Sample/ })).toHaveLength(0);
    }
    // No lead named: the canvas's words for who leads it.
    expect(bandsOf(container)[1].querySelector(".twc-cband__facts")!.textContent).toBe("Led byAmbassador-led");
  });

  it("a roster: a named spark per member in her neighborhood, unnamed ones up to the canvas's count, her card has her photo and name", () => {
    const { container } = renderWithQueries(<Page />, withRoster(ROSTER));
    const [nb, wq, sb] = bandsOf(container);
    const nbChart = nb.querySelector("svg.twc-starchart")!;
    expect([...nbChart.querySelectorAll("path.sc-named")].map((p) => p.querySelector("title")!.textContent)).toEqual(
      ["Ada Example · Potter · Clay Co, Greenpoint", "Bea Sample, Greenpoint", "Cy Placeholder · Florist, Williamsburg"]);
    expect(nbChart.querySelectorAll("path.sc-mem")).toHaveLength(50);
    // The unnamed stars take the neighborhoods in turn after the named ones (the canvas's order): 2+16, 1+16, 0+15.
    expect(subLabels(nbChart)).toEqual(["18 members", "17 members", "15 members", "★ neighborhood · ✦ member"]);
    expect(nbChart.getAttribute("aria-label")).toBe("North Brooklyn constellation: Greenpoint, Williamsburg, Bushwick, 50 members");
    expect(nbChart.querySelector("path.sc-mem:not(.sc-named) title")!.textContent).toMatch(/^Member \d+, /);
    expect(subLabels(wq.querySelector("svg.twc-starchart")!).slice(0, 2)).toEqual(["4 members", "4 members"]);
    expect(sb.querySelectorAll("path.sc-mem")).toHaveLength(15);
    expect(sb.querySelectorAll("path.sc-named")).toHaveLength(0);
    expect(sb.querySelectorAll(".twc-pf-card.is-open")).toHaveLength(2);

    const cards = [...nb.querySelectorAll(".twc-pf-card")];
    expect(cards.map((c) => c.querySelector("img")!.getAttribute("alt"))).toEqual(["Ada Example", "Bea Sample", "Cy Placeholder"]);
    expect(cards[0].querySelector("img")!.getAttribute("src")).toBe("/media/roster/ada-example.webp");
    expect(cards[0].textContent).toBe("AdaExample01Potter" + "Clay Co" + "Greenpoint");
    expect(wq.querySelector(".twc-cband__facts")!.textContent).toBe("Led byEve Testcase");
  });

  it("hovering a member's spark lights her card, and her card lights her spark", () => {
    const { container } = renderWithQueries(<Page />, withRoster(ROSTER));
    const nb = bandsOf(container)[0];
    const spark = nb.querySelector<SVGPathElement>("path.sc-named")!, id = spark.dataset.m!;
    fireEvent.mouseOver(spark);
    expect(nb.querySelector(`.twc-pf-card[data-m="${id}"]`)!.classList.contains("is-hl")).toBe(true);
    fireEvent.mouseOver(nb.querySelectorAll(".twc-pf-card")[2]);
    expect(spark.classList.contains("is-hl")).toBe(false);
    expect(nb.querySelectorAll("path.sc-named")[2].classList.contains("is-hl")).toBe(true);
  });

  it("the profile slider is keyboard reachable, with labelled previous and next buttons", () => {
    renderWithQueries(<Page />, withRoster(ROSTER));
    const region = screen.getByRole("region", { name: "North Brooklyn member profiles" });
    expect(region.tabIndex).toBe(0);
    expect(screen.getAllByRole("button", { name: "Next profiles" })).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: "Previous profiles" })).toHaveLength(5);
  });

  it("the member strip shows roster portraits with name and role · neighborhood, both areas in turn, and opens the directory once", () => {
    const { container } = renderWithQueries(<Page />, withRoster(ROSTER));
    const strip = screen.getByRole("heading", { name: "The women behind the collective", level: 2 }).closest("section")!;
    const items = [...strip.querySelectorAll<HTMLLIElement>("li.twc-strip__item")];
    expect(items.map((a) => a.textContent)).toEqual(["Ada ExamplePotter · Greenpoint", "Dee FixtureBaker · Astoria", "Bea SampleGreenpoint", "Cy PlaceholderFlorist · Williamsburg"]);
    expect(within(strip).getAllByRole("link")).toHaveLength(1);
    expect(within(strip).getByRole("link", { name: /Open the directory/ }).getAttribute("href")).toBe("/directory");
    expect(container.textContent).not.toMatch(/demo/i);
  });

  it("the strip leaves out the founder, who is named as North Brooklyn's lead", () => {
    renderWithQueries(<Page />, withRoster({ ...ROSTER, members: [person("Fay Founder", "Greenpoint", "NB", { founder: true }), ...ROSTER.members] }));
    const strip = screen.getByRole("heading", { name: "The women behind the collective", level: 2 }).closest("section")!;
    expect(strip.textContent).not.toMatch(/Fay Founder/);
  });

  it("while the roster loads the strip keeps its space; with an empty roster there is no strip", () => {
    const pending = renderWithQueries(<Page />);
    expect(pending.container.querySelector(".twc-members--pending")).toBeTruthy();
    pending.unmount();
    const empty = renderWithQueries(<Page />, withRoster({ members: [], leads: {} }));
    expect(empty.container.querySelector(".twc-members")).toBeNull();
  });

  it("no real member's name is in the source: the roster lives only on the server", () => {
    // Checked wherever a roster folder is at hand (a dev data dir); the repository itself must never hold one.
    const files = [process.env.DATA_DIR, "data", ".dev-data"].filter(Boolean).map((d) => join(d!, "roster", "roster.json")).filter((f) => existsSync(f));
    const stored = files.flatMap((f) => {
      const r = JSON.parse(readFileSync(f, "utf8")) as { members?: { name: string; founder?: boolean }[]; leads?: Record<string, string> };
      const founders = (r.members ?? []).filter((m) => m.founder).map((m) => m.name);
      return [...(r.members ?? []).filter((m) => !m.founder).map((m) => m.name), ...Object.values(r.leads ?? {}).filter((n) => !founders.includes(n))];
    });
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css|json|md)$/.test(n) ? [p] : []; });
    const source = walk("src").map((p) => readFileSync(p, "utf8")).join("\n");
    for (const name of stored) expect(source.includes(name), name).toBe(false);
    expect(existsSync(join("src", "roster.json")) || existsSync(join("public", "roster"))).toBe(false);
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

  it("five constellation bands, as closed native details: the two live ones join, the others look for leads", () => {
    renderWithQueries(<Page />);
    const section = screen.getByRole("heading", { name: "Five constellations", level: 2 }).closest("section")!;
    const bands = [...section.querySelectorAll("details.twc-cband")] as HTMLDetailsElement[];
    expect(bands.map((d) => d.querySelector(".twc-cband__name")!.textContent)).toEqual(
      ["North Brooklyn", "Western Queens", "Brownstone Brooklyn", "Uptown Manhattan", "Downtown Manhattan"]);
    expect(bands.map((d) => d.querySelector(".twc-cband__st")!.textContent)).toEqual(
      ["Live · Founding 50", "Live", "Launching", "Ambassador wanted", "Ambassador wanted"]);
    expect(bands.every((d) => !d.open)).toBe(true);
    expect(within(bands[0]).getByRole("link", { name: "Join North Brooklyn" }).getAttribute("href")).toBe("/join");
    expect(within(bands[1]).getByRole("link", { name: "Join Western Queens" }).getAttribute("href")).toBe("/join");
    for (const d of bands.slice(2)) expect(within(d).getByRole("link", { name: "Apply to lead it" }).getAttribute("href")).toBe("/contact");
  });

  it("each band's star chart names its neighborhoods, with a legend; open seats only where no member lives", () => {
    const { container } = renderWithQueries(<Page />);
    const charts = [...container.querySelectorAll("svg.twc-starchart")];
    expect(charts.map((s) => s.getAttribute("aria-label"))[0]).toBe("North Brooklyn constellation: Greenpoint, Williamsburg, Bushwick");
    expect(charts).toHaveLength(5);
    expect(subLabels(charts[0]).at(-1)).toBe("★ neighborhood · ✦ member");
    expect(subLabels(charts[4]).at(-1)).toBe("★ neighborhood · ✦ member · ☆ open seat");
    expect(charts[4].textContent).toMatch(/Your star here/);
  });

  it("seven experience tiles describe the ways to take part (not links), with five uncaptioned photos between them", () => {
    const { container } = renderWithQueries(<Page />);
    const grid = container.querySelector(".twc-grid6")!;
    const tiles = [...grid.querySelectorAll("article.twc-tile")];
    expect(tiles.map((a) => a.querySelector("h3")!.textContent)).toEqual(["Constellation Zooms", "Coffee Connections", "Constellation Meetups",
      "Expert Panels", "Hands-on Workshops", "Incubator Growth Sessions", "Happy Hours"]);
    expect(grid.querySelectorAll("a")).toHaveLength(0);
    expect(grid.querySelectorAll(".twc-tile--photo img")).toHaveLength(5);
    expect(grid.querySelectorAll(".twc-tile--photo span, figcaption")).toHaveLength(0);
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

  it("the program with no events (or Cal down) is one line under the tiles linking the calendar, not an empty section", () => {
    const { container } = renderWithQueries(<Page />, [[["cal", "events", { tab: "upcoming", take: 5 }], { events: [], total: 0, categories: [], host: null }]]);
    expect(screen.queryByRole("heading", { name: /^Program/ })).toBeNull();
    expect(container.querySelector(".twc-ev")).toBeNull();
    expect(screen.getByText(/New dates are posted as they’re announced/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the calendar" }).getAttribute("href")).toBe("/events");
  });

  it("while the calendar loads the program shows nothing, so no empty state flashes first", () => {
    renderWithQueries(<Page />);
    expect(screen.queryByRole("heading", { name: /^Program/ })).toBeNull();
    expect(screen.queryByText(/New dates are posted/)).toBeNull();
  });

  it("opens with the page's own h1 and one plain line saying what the Collective is", () => {
    renderWithQueries(<Page />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Find your people. Build what comes next.");
    expect(h1.className).not.toMatch(/sr-only/);
    expect(h1.parentElement!.textContent).toMatch(/A local-first network of women in business, one neighborhood at a time/);
  });

  it("the letter has its own email signup at #letter, and no placeholder partner card", () => {
    const { container } = renderWithQueries(<Page />);
    const letter = container.querySelector("section#letter")!;
    expect(within(letter as HTMLElement).getByRole("heading", { name: "The Collective letter", level: 2 })).toBeTruthy();
    expect(within(letter as HTMLElement).getByRole("textbox", { name: /email/i })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Your brand here/i);
    expect(screen.queryByRole("link", { name: /See packages/ })).toBeNull();
  });

  it("lead or partner: ambassadors write through /contact, partners see /partnerships and the canvas's price ranges", () => {
    const { container } = renderWithQueries(<Page />);
    const partner = screen.getByRole("heading", { name: "Partner with us" }).closest(".twc-panel")!;
    expect([...partner.querySelectorAll(".twc-panel__info p")].map((p) => p.textContent)).toEqual(
      ["Event$500–1,500", "Letter$150–500 an issue", "Founding$7,500–10,000 a year"]);
    expect(container.textContent).toMatch(/Uptown.?Two seats open/);
    expect(screen.getByRole("link", { name: "Apply to be an ambassador" }).getAttribute("href")).toBe("/contact");
    expect(screen.getByRole("link", { name: /Ways to partner/ }).getAttribute("href")).toBe("/partnerships");
  });

  it("never says gathering (the word is events) and, without a roster, names no member beyond the founder", () => {
    const { container } = renderWithQueries(<Page />);
    expect(container.textContent).not.toMatch(/gathering/i);
    expect(container.textContent).not.toMatch(/Shauna/);
  });

  it("drops the old decorations: no scallop, ribbon, polaroid, stamp, ticket or retired script face, and nothing loops", () => {
    const { container } = renderWithQueries(<Page />);
    expect(container.querySelector(".twc-scallop, .sb-ribbon, .twc-ribbon, .twc-polaroid, .sb-stamp, .twc-stamp, .twc-ticket, .font-script, .font-fragment, .sb-write, .animate-marquee")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pause/ })).toBeNull();
  });

  it("the only prices outside the membership section are the partner ranges", () => {
    const { container } = renderWithQueries(<Page />);
    const outside = [...container.querySelectorAll("main > *")].filter((el) => !el.closest(".twc-duo, .twc-arches"));
    for (const el of outside) expect(el.textContent).not.toMatch(/\$\d/);
  });
});
