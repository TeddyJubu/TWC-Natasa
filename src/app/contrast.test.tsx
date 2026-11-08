// @vitest-environment jsdom
// T26: WCAG AA contrast, asserted against the real token values in theme.css.
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Input, MemberCard, Navbar, Statement, Tabs, buttonVariants, type MemberProfile } from "@/index";
import { renderWithQueries } from "@/test/dom";
import { blend, contrast, tokens } from "@/test/contrast";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/index";

afterEach(cleanup);

const { light, night } = tokens;
const HOODS = ["lic", "sunnyside", "astoria", "jackson-heights", "elmhurst", "forest-hills", "rego-park"] as const;
const AA = 4.5;
const AA_LARGE = 3; // ≥ 24px regular: every serif use below
const classes = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

describe("contrast helper", () => {
  it("matches known WCAG ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(blend("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("primary button", () => {
  it("fills with the darker sky-strong variant; sky itself is untouched", () => {
    expect(light.sky).toBe("#1f8ad6");
    const cls = buttonVariants().split(" ");
    expect(cls).toContain("bg-sky-strong");
    expect(cls).toContain("text-sky-ink");
    expect(contrast(light["sky-strong"], light["sky-ink"])).toBeGreaterThanOrEqual(AA);
  });

  it("darkens (never brightens) on hover, so the hover state stays AA too", () => {
    const hover = buttonVariants().split(" ").find((c) => c.startsWith("hover:brightness-"));
    expect(Number(hover?.split("-").pop())).toBeLessThanOrEqual(100);
  });
});

describe("ink-faint", () => {
  it("statement and idle tabs use it, at ≥ 3:1 (large text) on light and night canvas", () => {
    render(<Statement text="Lead words fade out" lead={1} />);
    expect(classes(screen.getByText(/fade out/))).toContain("text-ink-faint");
    render(<Tabs items={[{ label: "One", content: "a" }, { label: "Two", content: "b" }]} />);
    expect(classes(screen.getByRole("tab", { name: "Two" }))).toContain("text-ink-faint");
    expect(contrast(light["ink-faint"], light.canvas)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrast(night["ink-faint"], night.canvas)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it(".tone-light repeats every light token value", () => {
    const css = readFileSync(`${process.cwd()}/src/design-system/styles/theme.css`, "utf8");
    const forced = [...css.slice(css.indexOf(".tone-light")).matchAll(/--bl-([\w-]+):\s*(#[0-9a-f]{6})/gi)];
    expect(forced.length).toBeGreaterThan(5);
    for (const [, name, hex] of forced) expect({ name, hex: hex.toLowerCase() }).toEqual({ name, hex: light[name] });
  });

  it("placeholders use ink-muted at reduced alpha: ≥ 4.5:1 on canvas and surface, and still lighter than typed ink", () => {
    render(<Input placeholder="Your name" />);
    const cls = classes(screen.getByPlaceholderText("Your name")).find((c) => c.startsWith("placeholder:text-ink-muted"));
    const alpha = Number(cls?.split("/")[1] ?? 100) / 100;
    for (const t of [light, night]) {
      for (const bg of [t.canvas, t.surface]) expect(contrast(blend(t["ink-muted"], bg, alpha), bg)).toBeGreaterThanOrEqual(AA);
    }
    expect(contrast(blend(light["ink-muted"], light.canvas, alpha), light.ink)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("admin phone tabs stay large text (24px), since idle tabs only clear 3:1", () => {
    const admin = readFileSync(`${process.cwd()}/src/routes/_authenticated/_admin/admin.tsx`, "utf8");
    expect(admin).not.toMatch(/\[role=tab\]\]:text-(xs|sm|base|lg|xl)\b/);
  });
});

describe("homepage neighborhood cards", () => {
  it("each title clears 3:1 against its neighborhood colour (white on dark hues, black on light ones)", () => {
    const Page = Route.options.component as React.ComponentType;
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
    const cards = [...document.querySelectorAll("#constellation article")];
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      const overlay = card.querySelector("[class*='bg-gradient-to-t']")!;
      const hood = classes(overlay).find((c) => c.startsWith("from-"))!.slice(5);
      const title = card.querySelector("h3")!;
      const ink = classes(title).includes("text-black") ? "#000000" : "#ffffff";
      expect({ hood, ok: contrast(light[hood], ink) >= AA_LARGE }).toEqual({ hood, ok: true });
    }
  });
});

describe("catalogue card", () => {
  const member: MemberProfile = {
    id: "m1", name: "Test Member", role: "Founder", business: "Studio", neighborhood: "Astoria",
    specialty: "", bio: "", lookingFor: "", image: "/x.jpg", imageAlt: "Portrait",
  };

  it("is always a night card, so number and label read on every neighborhood colour", () => {
    const { container } = render(<MemberCard member={member} variant="catalogue" tone={{ color: light.astoria }} catalogueNumber={7} />);
    expect(classes(container.querySelector("article")!)).toContain("tone-night");
    expect(classes(screen.getByLabelText("Catalogue number 7").firstElementChild!)).toContain("text-canvas");
    for (const hood of HOODS) {
      expect({ hood, number: contrast(night.canvas, light[hood]) >= AA_LARGE }).toEqual({ hood, number: true });
      expect({ hood, label: contrast(light[hood], night.canvas) >= AA }).toEqual({ hood, label: true });
    }
  });

  it("without a tone, the number is ink on surface", () => {
    render(<MemberCard member={member} variant="catalogue" catalogueNumber={3} />);
    expect(classes(screen.getByLabelText("Catalogue number 3").firstElementChild!)).toContain("text-ink");
    expect(contrast(night.ink, night.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe("mobile menu button", () => {
  const borderAlpha = (variant: "solid" | "hero" | "overlay") => {
    render(<Navbar variant={variant} brand="Brand" links={[{ label: "Members", href: "/members" }]} />);
    const border = classes(screen.getByRole("button", { expanded: false })).find((c) => c.startsWith("border-current"));
    cleanup();
    return Number(border?.split("/")[1] ?? 100) / 100;
  };

  it("has a border of at least 3:1: ink on the light bar, white over the hero sky", () => {
    expect(contrast(blend(light.ink, light.canvas, borderAlpha("solid")), light.canvas)).toBeGreaterThanOrEqual(AA_LARGE);
    for (const v of ["hero", "overlay"] as const) {
      expect(contrast(blend("#ffffff", light.sky, borderAlpha(v)), light.sky)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe("account app shell (neutral app palette)", () => {
  // [text, background, alpha of a tinted background over `app`]: every text pair the /account shell uses.
  const pairs: [string, string, number?][] = [
    ["ink", "app"], ["ink", "app-sunken"], ["ink-muted", "app-sunken"], ["app-muted", "app"], ["app-muted", "app-sunken"],
    ["app-accent", "app"], ["app-accent", "app-accent", 0.1], ["canvas", "ink"],
  ];

  it.each(["light", "night"] as const)("every text pair clears AA in %s", (mode) => {
    const t = tokens[mode];
    for (const [fg, bg, alpha] of pairs) {
      const back = alpha === undefined ? t[bg] : blend(t[bg], t.app, alpha);
      expect({ fg, bg, ok: contrast(t[fg], back) >= AA }).toEqual({ fg, bg, ok: true });
    }
  });

  it("the account sources use the app tokens, never raw hex or palette colours", () => {
    const dir = `${process.cwd()}/src/features/account`;
    const src = readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n")
      + readFileSync(`${process.cwd()}/src/routes/_authenticated/account.tsx`, "utf8");
    expect(src).toMatch(/text-app-muted/);
    expect(src).toMatch(/text-app-accent/);
    expect(src).not.toMatch(/(?:bg|text|border|fill|stroke|ring|outline)-\[#|(?:bg|text|border)-(?:zinc|gray|neutral|slate|blue)-\d/);
  });
});
