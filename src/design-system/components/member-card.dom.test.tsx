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
