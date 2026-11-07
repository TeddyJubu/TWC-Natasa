import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
const componentsDir = new URL("../components/", import.meta.url);
const components = readdirSync(componentsDir)
  .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
  .map((f) => readFileSync(new URL(f, componentsDir), "utf8"))
  .join("\n");

/** Declarations of the last keyframe (`to` / `100%`) of `@keyframes name`. */
function finalFrame(name: string) {
  const start = css.indexOf(`@keyframes ${name} `);
  if (start < 0) return null;
  let depth = 0, end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) { end = i; break; }
  }
  const frames = [...css.slice(css.indexOf("{", start) + 1, end).matchAll(/([\w%,\s]+)\{([^}]*)\}/g)];
  return frames.find(([, sel]) => /\b(to|100%)/.test(sel))?.[2] ?? null;
}

const value = (decls: string, prop: string) => decls.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+)`))?.[1].trim();

// A transform or filter other than `none` that stays applied makes the element a containing block,
// so `position: fixed` descendants pin to it instead of the viewport (T22).
describe("resting motion states don't trap position: fixed", () => {
  // `animation: bl-x … both` in CSS, and `animate-[bl-x_…_both]` / `[animation:bl-x_…_both]` in components.
  const filled = [
    ...new Set(
      [...`${css}\n${components}`.matchAll(/(bl-[a-z0-9-]+)[^;\]\n]*?[\s_](both|forwards)\b/g)].map((m) => m[1]),
    ),
  ];

  it("finds the route transition and the check mark among the filled animations", () => {
    expect(filled).toEqual(expect.arrayContaining(["bl-route-in", "bl-check"]));
  });

  it.each(filled)("%s ends with no transform or filter", (name) => {
    const frame = finalFrame(name);
    expect(frame, `no final keyframe for ${name}`).not.toBeNull();
    expect(value(frame!, "transform") ?? "none").toBe("none");
    expect(value(frame!, "filter") ?? "none").toBe("none");
  });

  it("a revealed .motion-observed block rests with no transform or filter", () => {
    const rule = css.match(/\.motion-observed\[data-visible="true"\]\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(value(rule, "transform")).toBe("none");
    expect(value(rule, "filter")).toBe("none");
  });
});

// A modal member profile scrolls inside itself; the page behind it must not scroll (or chain-scroll) along.
describe("modal dialogs lock page scroll", () => {
  it("hides html overflow while a modal dialog is open", () => {
    const rule = css.match(/html:has\(dialog\[open\]:modal\)\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(value(rule, "overflow")).toBe("hidden");
  });
});
