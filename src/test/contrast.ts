// Test-only WCAG 2.x contrast helpers, fed with the real token values parsed from theme.css.
import { readFileSync } from "node:fs";

const channels = (hex: string) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two opaque colours, 1–21. */
export function contrast(hexA: string, hexB: string) {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` composited over opaque `bg`. */
export function blend(fg: string, bg: string, alpha: number) {
  const f = channels(fg);
  const b = channels(bg);
  return `#${f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]).toString(16).padStart(2, "0")).join("")}`;
}

const css = readFileSync(`${process.cwd()}/src/design-system/styles/theme.css`, "utf8");

function block(selector: string) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`theme.css has no ${selector} block`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--bl-([\w-]+):\s*(#[0-9a-f]{3,6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}

/** Hex tokens (`--bl-*`, without the prefix) for light (`:root`) and night (`.dark, .tone-night`). */
export const tokens = {
  light: block(":root {") as Record<string, string>,
  night: { ...block(":root {"), ...block(".dark,\n.tone-night {") } as Record<string, string>,
};
