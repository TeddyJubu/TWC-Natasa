// Test-only: heading-outline checks for rendered pages (WCAG 1.3.1 / 2.4.6).
import { expect } from "vitest";

const HIDDEN = "[hidden], [aria-hidden='true']";

/** Heading levels in document order, skipping headings inside hidden or aria-hidden subtrees. */
export function headingLevels(root: ParentNode = document.body): { level: number; text: string }[] {
  return [...root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, [role=heading]")]
    .filter((el) => !el.closest(HIDDEN))
    .map((el) => ({
      level: el.getAttribute("role") === "heading" ? Number(el.getAttribute("aria-level") ?? 2) : Number(el.tagName[1]),
      text: (el.textContent ?? "").trim(),
    }));
}

/** Every step down the outline goes at most one level deeper (h1 → h3 is a skip; h3 → h2 is fine). */
export function headingSkips(root: ParentNode = document.body): string[] {
  const levels = headingLevels(root);
  return levels.flatMap((h, i) => {
    const prev = levels[i - 1];
    return prev && h.level > prev.level + 1 ? [`h${prev.level} "${prev.text}" → h${h.level} "${h.text}"`] : [];
  });
}

export function expectNoSkippedHeadings(root: ParentNode = document.body) {
  expect(headingLevels(root).length, "no headings rendered").toBeGreaterThan(0);
  expect(headingSkips(root)).toEqual([]);
}
