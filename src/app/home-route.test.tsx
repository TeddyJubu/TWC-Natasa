// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen } from "@testing-library/react";
import type { MemberProfile } from "@/index";
import { demoMembers } from "@/showcase/demo-members";
import hero from "@/assets/photography/hero.jpg";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);
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

  it("skips public members without a portrait instead of showing the stock hero photo as them", () => {
    renderWithQueries(<Page />, [[["public-profiles"], [{ ...card("No Photo", 30), image: hero }, card("Pia Lund", 21)]]]);
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

  it("fetches public_profiles() itself, and never the members-only directory", async () => {
    fake.results = [{ data: [], error: null }];
    renderWithQueries(<Page />);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fake.calls).toContainEqual(["rpc", "public_profiles"]);
    expect(fake.calls).not.toContainEqual(["rpc", "public_directory"]);
    expect(screen.queryByTestId("gallery")).toBeNull();
  });
});
