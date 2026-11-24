// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";
import { demoMembers } from "@/showcase/demo-members";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
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

  it("the mission block sits in #mission and its Join us button goes to /join", () => {
    renderWithQueries(<Page />);
    const mission = screen.getByRole("heading", { name: "Our mission", level: 3 }).closest("#mission")!;
    expect(mission).not.toBeNull();
    expect(within(mission as HTMLElement).getByRole("link", { name: /^Join us/ }).getAttribute("href")).toBe("/join");
  });

  it("North Brooklyn follows the hero: labelled map, four neighbors, link to /neighborhoods", () => {
    renderWithQueries(<Page />);
    const section = screen.getByRole("heading", { name: "We’re in North Brooklyn too.", level: 2 }).closest("section")!;
    expect(section.previousElementSibling).toBe(screen.getByRole("heading", { level: 1 }).closest("section"));
    expect(within(section).getByRole("img").getAttribute("aria-label")).toMatch(/Newtown Creek/);
    expect(within(section).getAllByRole("listitem").map((li) => li.lastElementChild!.textContent)).toEqual(["Greenpoint", "Williamsburg", "East Williamsburg", "Bushwick"]);
    expect(within(section).getByRole("link", { name: /Explore the neighborhoods/ }).getAttribute("href")).toBe("/neighborhoods");
  });

  it("the neighborhood colour row comes from the neighborhoods data, active ones only", () => {
    const hoods = [...NEIGHBORHOOD_SEED.slice(0, 2), { ...NEIGHBORHOOD_SEED[2], active: false }, { slug: "woodside", name: "Woodside", color: "#123456", logoUrl: null, active: true }];
    renderWithQueries(<Page />, [[["neighborhoods"], hoods]]);
    const items = within(screen.getByRole("list", { name: "Neighborhood colors" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Long Island City", "Astoria", "Woodside"]);
    expect((items[2].querySelector(".twc-dot") as HTMLElement).style.getPropertyValue("--hood")).toBe("#123456");
  });

  it("the neighborhood ribbon names the active neighborhoods only, never a hard-coded one", () => {
    const hoods = [...NEIGHBORHOOD_SEED.slice(0, 2), { slug: "woodside", name: "Woodside", color: "#123456", logoUrl: null, active: false }];
    renderWithQueries(<Page />, [[["neighborhoods"], hoods]]);
    const band = screen.getByRole("region", { name: "Neighborhoods" });
    expect(within(band).getByText(/^Across /).textContent).toBe("Across Long Island City, Astoria.");
    expect(band.textContent).not.toContain("Woodside");
    expect(band.querySelector(".sb-ribbon.bg-sb-lilac")!.textContent).toContain("Astoria");
  });

  it("the neighborhood ribbon falls back to the seed list (no Woodside) when none is active", () => {
    renderWithQueries(<Page />, [[["neighborhoods"], []]]);
    const band = screen.getByRole("region", { name: "Neighborhoods" });
    expect(within(band).getByText(/^Across /).textContent).toBe(`Across ${NEIGHBORHOOD_SEED.map((n) => n.name).join(", ")}.`);
    expect(band.textContent).not.toContain("Woodside");
  });

  it("FAQ: three questions, more on /faq, questions go to /contact", () => {
    renderWithQueries(<Page />);
    const faq = document.getElementById("faq")!;
    expect(faq.querySelectorAll("details")).toHaveLength(3);
    expect(within(faq).getByRole("link", { name: /More questions/ }).getAttribute("href")).toBe("/faq");
    expect(within(faq).getByRole("link", { name: /Ask us anything/ }).getAttribute("href")).toBe("/contact");
  });

  it("the looping decorations have a pause control (WCAG 2.2.2)", () => {
    renderWithQueries(<Page />);
    const pause = screen.getByRole("button", { name: "Pause the page’s moving decorations" });
    expect(pause.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pause);
    expect(pause.getAttribute("aria-pressed")).toBe("true");
  });
});
