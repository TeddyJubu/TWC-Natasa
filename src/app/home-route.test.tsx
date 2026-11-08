// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen } from "@testing-library/react";
import type { MemberProfile } from "@/index";
import { demoMembers } from "@/showcase/demo-members";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));
// The WebGL engine can't run in jsdom; the route only decides which images it gets.
vi.mock("@/index", async (orig) => ({
  ...(await orig<object>()),
  CurvedGallery: ({ images }: { images: { src: string; alt: string }[] }) => (
    <ul data-testid="gallery">{images.map((i) => <li key={i.alt}><img src={i.src} alt={i.alt} /></li>)}</ul>
  ),
}));

import { Route } from "@/routes/index";

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
});

const card = (name: string, n: number): MemberProfile => ({
  id: `catalogue-${n}`, name, role: "Founder", business: `${name} Co`, neighborhood: "Astoria", specialty: "",
  bio: "", lookingFor: "", image: `https://signed/${n}`, imageAlt: `Portrait of ${name}`, catalogueNumber: n,
});

describe("/ (home) member gallery", () => {
  it("shows only opted-in public profiles", () => {
    renderWithQueries(<Page />, [[["public-profiles"], [card("Pia Lund", 21), card("Rosa Diaz", 12)]]]);
    const imgs = screen.getByTestId("gallery").querySelectorAll("img");
    expect([...imgs].map((i) => i.alt)).toEqual(["Pia Lund · Pia Lund Co", "Rosa Diaz · Rosa Diaz Co"]);
    expect([...imgs].map((i) => i.getAttribute("src"))).toEqual(["https://signed/21", "https://signed/12"]);
  });

  it("leaves public members without a portrait out of the image-only gallery", () => {
    const noPhoto: MemberProfile = { ...card("No Photo", 30), image: undefined, imageAlt: undefined };
    renderWithQueries(<Page />, [[["public-profiles"], [noPhoto, card("Pia Lund", 21)]]]);
    const alts = [...screen.getByTestId("gallery").querySelectorAll("img")].map((i) => i.alt);
    expect(alts).toEqual(["Pia Lund · Pia Lund Co"]);
  });

  it("with nobody public, keeps the heading and CTA but renders no gallery and no demo people", () => {
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    expect(screen.getByRole("heading", { name: "Women Doing Remarkable Work Nearby" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View the member directory" }).getAttribute("href")).toBe("/members");
    expect(screen.queryByTestId("gallery")).toBeNull();
    expect(screen.queryByText(/sample profiles/i)).toBeNull();
    for (const m of demoMembers) expect(screen.queryByAltText(new RegExp(m.name))).toBeNull();
  });

  it("fetches the public profiles itself, and never the members-only directory", async () => {
    fake.results = [[]];
    renderWithQueries(<Page />);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fake.calls).toContainEqual(["publicProfilesFn"]);
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
    expect(screen.queryByTestId("gallery")).toBeNull();
  });
});

describe("/ (home) structure", () => {
  it("never skips a heading level", () => {
    renderWithQueries(<Page />, [[["public-profiles"], [card("Pia Lund", 21)]]]);
    expectNoSkippedHeadings();
  });

  it("the mission section is introduced by an h2 wrapping its badge", () => {
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    const heading = screen.getByRole("heading", { name: "Our mission", level: 2 });
    expect(heading.closest("#mission")).not.toBeNull();
  });
});
