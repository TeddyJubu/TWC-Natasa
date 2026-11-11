// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings, headingLevels } from "@/test/headings";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route as About } from "@/routes/about";
import { Route as Faq } from "@/routes/faq";

afterEach(cleanup);

type AnyRoute = { options: { component?: unknown; head?: unknown } };
type Head = { meta: Record<string, string>[]; scripts?: { type: string; children: string }[] };
const head = (route: AnyRoute) => (route.options.head as () => Head)();
const show = (route: AnyRoute, seed: Parameters<typeof renderWithQueries>[1] = []) => {
  const Page = route.options.component as React.ComponentType;
  return renderWithQueries(<Page />, seed);
};
const main = () => screen.getByRole("main");
const href = (name: string | RegExp) => within(main()).getByRole("link", { name }).getAttribute("href");

describe.each([["/about", About], ["/faq", Faq]] as const)("%s", (_path, route) => {
  it("is indexable with a real title and description", () => {
    const { meta } = head(route);
    expect(meta).not.toContainEqual({ name: "robots", content: "noindex" });
    expect(meta.find((m) => m.name === "description")?.content).toBeTruthy();
    expect(meta.find((m) => m.property === "og:title")?.content).toBe(meta.find((m) => m.title)?.title);
  });

  it("has one main, one h1, no skipped headings and no [bracket] placeholders", () => {
    show(route);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectNoSkippedHeadings();
    expect(main().textContent).not.toMatch(/[[\]]/);
  });
});

describe("/about", () => {
  it("keeps the board's section order", () => {
    show(About);
    expect(headingLevels(main()).filter((h) => h.level <= 2).map((h) => h.text)).toEqual([
      "A collective built close to home.",
      "Opportunity starts with knowing who’s nearby.",
      "From hello to neighbor in four steps.",
      "What we value",
      "Meet Nataša (hi!)",
      "Every connection makes the whole community stronger",
      "There is room in this constellation.",
    ]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Introduce yourself", "A real person reads it", "Get welcomed in", "Show up", "Generous", "Local", "Inclusive",
    ]);
  });

  it("the arch photo is the high-priority hero, with an 800w downscale and its drawn width as sizes", () => {
    show(About);
    const img = main().querySelector("img[fetchpriority=high]")!;
    expect(img.getAttribute("srcset")).toMatch(/about-gathering-800\.webp 800w, \S*about-gathering\.webp 1280w$/);
    expect(img.getAttribute("sizes")).toBe("336px");
  });

  it("links the studio in a new tab, announced, and the CTAs to /neighborhoods and /join", () => {
    show(About);
    const studio = within(main()).getByRole("link", { name: /Visit Nataša’s studio/ });
    expect(studio.getAttribute("href")).toBe("https://natasatuohy.com/about/");
    expect(studio.getAttribute("target")).toBe("_blank");
    expect(studio.getAttribute("rel")).toContain("noreferrer");
    expect(studio.textContent).toContain("(opens in a new tab)");
    expect(href(/Explore the neighborhoods/)).toBe("/neighborhoods");
    expect(href(/Start your application/)).toBe("/join");
  });

  it("draws the neighborhood dots from the data, skipping inactive ones", () => {
    const hoods = [...NEIGHBORHOOD_SEED.slice(0, 2), { slug: "woodside", name: "Woodside", color: "#123456", logoUrl: null, active: false }];
    show(About, [[["neighborhoods"], hoods]]);
    const dots = screen.getByRole("img", { name: /^Neighborhood colors:/ });
    expect(dots.getAttribute("aria-label")).toBe("Neighborhood colors: Long Island City, Astoria");
    expect([...dots.querySelectorAll("span")].map((d) => d.getAttribute("title"))).toEqual(["Long Island City", "Astoria"]);
    expect(main().textContent).not.toContain("Woodside");
  });

  it("gives the moving ribbon a pause control", () => {
    show(About);
    expect(screen.getByRole("button", { name: "Pause the neighborhood ribbon" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("doesn't promise timing for what approval unlocks", () => {
    show(About);
    expect(main().textContent).not.toMatch(/at once|unlock everything/i);
  });
});

describe("/faq", () => {
  it("groups questions under topic headings that the table of contents links to", () => {
    show(Faq);
    const topics = ["Membership", "Your profile", "Headshots", "Gatherings", "Privacy"];
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([...topics, "Still wondering?"]);
    const toc = screen.getByRole("navigation", { name: "Topics" });
    expect(within(toc).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#membership", "#profile", "#headshots", "#gatherings", "#privacy"]);
    for (const id of ["membership", "profile", "headshots", "gatherings", "privacy"]) expect(document.getElementById(id)).toBeTruthy();
  });

  it("is one native accordion with the first question open, numbered across the page", () => {
    const { container } = show(Faq);
    const items = [...container.querySelectorAll("details")];
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((d) => d.getAttribute("name") === "faq")).toBe(true);
    expect(items.map((d) => d.open)).toEqual(items.map((_, i) => i === 0));
    expect(items.map((d) => d.querySelector(".twc-index")?.textContent)).toEqual(items.map((_, i) => String(i + 1).padStart(2, "0")));
  });

  it("leaves out questions that have no settled answer", () => {
    show(Faq);
    expect(main().textContent).not.toMatch(/How much does membership cost|Is the headshot session paid|guest/i);
  });

  it("links contact, and the ticket to /contact and /join", () => {
    show(Faq);
    expect(href("get in touch")).toBe("/contact");
    expect(href(/Contact us/)).toBe("/contact");
    expect(href(/Start your application/)).toBe("/join");
  });

  it("publishes FAQPage JSON-LD that matches the rendered questions", () => {
    const { container } = show(Faq);
    const [script] = head(Faq).scripts ?? [];
    expect(script.type).toBe("application/ld+json");
    const ld = JSON.parse(script.children) as { "@type": string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(ld["@type"]).toBe("FAQPage");
    const rendered = [...container.querySelectorAll("details")].map((d) => ({
      name: d.querySelector(".twc-faq__q")?.textContent,
      text: d.querySelector(".twc-faq__a")?.textContent,
    }));
    expect(ld.mainEntity.map((q) => ({ name: q.name, text: q.acceptedAnswer.text }))).toEqual(rendered);
  });
});
