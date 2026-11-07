// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemberCard, type MemberProfile } from "./member-card";

// Reduced motion keeps the loop and proximity text static under jsdom.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: true, addEventListener() {}, removeEventListener() {} }));
  const svgText = SVGElement.prototype as SVGElement & { getComputedTextLength?: () => number };
  svgText.getComputedTextLength ??= () => 0;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const member: MemberProfile = {
  id: "m1", name: "Rosa Diaz", role: "Founder", business: "Diaz Bakery", neighborhood: "Astoria",
  specialty: "Food", bio: "", lookingFor: "", image: "/x.jpg", imageAlt: "Portrait of Rosa Diaz",
};

/** Text a screen reader reaches: everything outside an aria-hidden subtree. */
const announced = (root: Element) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let out = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!n.parentElement?.closest("[aria-hidden='true']")) out += `${n.textContent} `;
  return out;
};

describe("catalogue MemberCard", () => {
  it("hides the decorative curved-loop ring and its logo from assistive tech", () => {
    const { container } = render(<MemberCard member={member} variant="catalogue" />);
    expect(announced(container)).not.toMatch(/Member catalogue/);
    expect(screen.queryByRole("img", { name: "The Women’s Collective" })).toBeNull();
  });

  it("still announces the member's name, role and business", () => {
    const { container } = render(<MemberCard member={member} variant="catalogue" />);
    const text = announced(container);
    for (const part of ["Rosa Diaz", "Founder", "Diaz Bakery"]) expect(text).toContain(part);
    expect(screen.getByRole("img", { name: "Portrait of Rosa Diaz" })).toBeTruthy();
  });
});

describe.each(["catalogue", "grid", "featured"] as const)("%s MemberCard without a portrait", (variant) => {
  const noPortrait: MemberProfile = { ...member, image: undefined, imageAlt: undefined };
  const logoAlt = "The Women’s Collective";

  it("renders no portrait <img> at all", () => {
    const { container } = render(<MemberCard member={noPortrait} variant={variant} />);
    // The catalogue's decorative brand mark is the only image a card may carry without a portrait.
    const portraits = [...container.querySelectorAll("img")].filter((img) => img.alt !== logoAlt);
    expect(portraits).toEqual([]);
  });

  it("shows the member's initials on a mat, hidden from assistive tech", () => {
    render(<MemberCard member={noPortrait} variant={variant} />);
    const mat = screen.getByText("RD");
    expect(mat.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("never announces a portrait", () => {
    const { container } = render(<MemberCard member={noPortrait} variant={variant} />);
    expect(announced(container)).not.toMatch(/Portrait of/);
    expect(screen.queryByRole("img", { name: /Portrait/ })).toBeNull();
    expect(container.innerHTML).not.toMatch(/Portrait of/);
  });

  it("still names the member in the heading", () => {
    render(<MemberCard member={noPortrait} variant={variant} />);
    expect(screen.getByRole("heading", { name: "Rosa Diaz" })).toBeTruthy();
  });
});

describe.each(["catalogue", "grid", "featured"] as const)("%s MemberCard with a portrait", (variant) => {
  it("shows the portrait and no initials mat", () => {
    render(<MemberCard member={member} variant={variant} />);
    expect(screen.getByRole("img", { name: "Portrait of Rosa Diaz" }).getAttribute("src")).toBe("/x.jpg");
    expect(screen.queryByText("RD")).toBeNull();
  });
});

describe.each(["grid", "featured"] as const)("%s MemberCard neighborhood badge", (variant) => {
  it("is white glass over a portrait, with its scrim", () => {
    render(<MemberCard member={member} variant={variant} />);
    const badge = screen.getByText("Astoria");
    expect(badge.className).toContain("text-white");
    expect(badge.parentElement?.querySelector("[class*='from-black']")).not.toBeNull();
  });

  it("is an ink pill on the light initials mat (white glass would fail contrast)", () => {
    render(<MemberCard member={{ ...member, image: undefined, imageAlt: undefined }} variant={variant} />);
    const badge = screen.getByText("Astoria");
    expect(badge.className).not.toContain("text-white");
    expect(badge.className).toContain("text-ink");
    expect(badge.parentElement?.querySelector("[class*='from-black']")).toBeNull();
  });
});
