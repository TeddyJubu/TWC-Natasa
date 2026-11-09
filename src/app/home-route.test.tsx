// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { MemberProfile } from "@/index";
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

const card = (name: string, n: number, neighborhood = "Astoria"): MemberProfile => ({
  id: `catalogue-${n}`, name, role: "Founder", business: `${name} Co`, neighborhood, specialty: "",
  bio: "", lookingFor: "", image: `https://signed/${n}`, imageAlt: `Portrait of ${name}`, catalogueNumber: n,
});
const strip = () => screen.getByRole("heading", { name: "Women doing remarkable work nearby." }).closest("section")!;
const polaroids = () => [...strip().querySelectorAll("figure")];

describe("/ (home) meet the members", () => {
  it("shows only opted-in public profiles, captioned first name and neighborhood", () => {
    renderWithQueries(<Page />, [[["public-profiles"], [card("Pia Lund", 21, "Sunnyside"), card("Rosa Diaz", 12)]]]);
    expect(polaroids().map((f) => f.querySelector("img")!.getAttribute("src"))).toEqual(["https://signed/21", "https://signed/12"]);
    expect(polaroids().map((f) => f.querySelector("img")!.alt)).toEqual(["Portrait of Pia Lund", "Portrait of Rosa Diaz"]);
    expect(polaroids().map((f) => f.textContent)).toEqual(["Pia, Sunnyside", "Rosa, Astoria"]);
  });

  it("leaves public members without a portrait out: no stand-in photo", () => {
    const noPhoto: MemberProfile = { ...card("No Photo", 30), image: undefined, imageAlt: undefined };
    renderWithQueries(<Page />, [[["public-profiles"], [noPhoto, card("Pia Lund", 21)]]]);
    expect(polaroids().map((f) => f.textContent)).toEqual(["Pia, Astoria"]);
  });

  it("with nobody public, hides the row but keeps the heading and the directory link; no demo people", () => {
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    expect(within(strip()).queryByRole("list")).toBeNull();
    expect(within(strip()).getByRole("link", { name: /View the member directory/ }).getAttribute("href")).toBe("/members");
    for (const m of demoMembers) expect(screen.queryByAltText(new RegExp(m.name))).toBeNull();
  });

  it("fetches the public profiles itself, and never the members-only directory", async () => {
    fake.results = [[]];
    renderWithQueries(<Page />);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fake.calls).toContainEqual(["publicProfilesFn"]);
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
    expect(polaroids()).toHaveLength(0);
  });
});

describe("/ (home) structure", () => {
  it("never skips a heading level, with one h1", () => {
    renderWithQueries(<Page />, [[["public-profiles"], [card("Pia Lund", 21)]]]);
    expectNoSkippedHeadings();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("is indexable: no noindex", () => {
    const { meta } = (Route.options.head as () => { meta: Record<string, string>[] })();
    expect(meta.find((m) => m.name === "robots")).toBeUndefined();
  });

  it("the mission block sits in #mission and invites people to /join", () => {
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    const mission = screen.getByRole("heading", { name: "Our mission", level: 3 }).closest("#mission")!;
    expect(mission).not.toBeNull();
    expect(within(mission as HTMLElement).getByRole("link", { name: /Introduce yourself/ }).getAttribute("href")).toBe("/join");
  });

  it("North Brooklyn follows the hero: labelled map, four neighbors, link to /neighborhoods", () => {
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    const section = screen.getByRole("heading", { name: "Our neighbors in North Brooklyn.", level: 2 }).closest("section")!;
    expect(section.previousElementSibling).toBe(screen.getByRole("heading", { level: 1 }).closest("section"));
    expect(within(section).getByRole("img").getAttribute("aria-label")).toMatch(/Newtown Creek/);
    expect(within(section).getAllByRole("listitem").map((li) => li.lastElementChild!.textContent)).toEqual(["Greenpoint", "Williamsburg", "East Williamsburg", "Bushwick"]);
    expect(within(section).getByRole("link", { name: /Explore the neighborhoods/ }).getAttribute("href")).toBe("/neighborhoods");
  });

  it("the neighborhood colour row comes from the neighborhoods data, active ones only", () => {
    const hoods = [...NEIGHBORHOOD_SEED.slice(0, 2), { ...NEIGHBORHOOD_SEED[2], active: false }, { slug: "woodside", name: "Woodside", color: "#123456", logoUrl: null, active: true }];
    renderWithQueries(<Page />, [[["public-profiles"], []], [["neighborhoods"], hoods]]);
    const items = within(screen.getByRole("list", { name: "Neighborhood colors" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Long Island City", "Astoria", "Woodside"]);
    expect((items[2].querySelector(".twc-dot") as HTMLElement).style.getPropertyValue("--hood")).toBe("#123456");
  });

  it("FAQ: three questions, more on /faq, questions go to /contact", () => {
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    const faq = document.getElementById("faq")!;
    expect(faq.querySelectorAll("details")).toHaveLength(3);
    expect(within(faq).getByRole("link", { name: /More questions/ }).getAttribute("href")).toBe("/faq");
    expect(within(faq).getByRole("link", { name: /Ask us anything/ }).getAttribute("href")).toBe("/contact");
  });

  it("the looping decorations have a pause control (WCAG 2.2.2)", () => {
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    const pause = screen.getByRole("button", { name: "Pause the page’s moving decorations" });
    expect(pause.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pause);
    expect(pause.getAttribute("aria-pressed")).toBe("true");
  });
});
