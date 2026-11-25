// @vitest-environment jsdom
// T26: WCAG AA contrast, asserted against the real token values in theme.css.
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Input, MemberCard, Navbar, Statement, Tabs, buttonVariants, type MemberProfile } from "@/index";
import { blend, contrast, tokens } from "@/test/contrast";
import { installDomStubs } from "@/test/dom";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

installDomStubs();
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

describe("internal tools (the canvas kit: /account, /directory, /feed, /admin)", () => {
  // [text, background]: every pair the signed-in pages use. Inside `.air` errors are wine (`air-red`, which `.air`
  // points `danger` at) and links and focus are cobalt (`app-accent`); white is the label on the ink and wine pills.
  // Ink on the colour fields (lime, blush, lilac, butter, stone, mint) is the public palette's test below: `.air`
  // turns muted text and links on a field to ink.
  const t: Record<string, string> = { ...light, white: "#ffffff" };
  const pairs: [string, string][] = [
    ["air-navy", "air-paper"], ["air-navy", "air-sky"], ["air-navy", "air-tint"],
    ["air-muted", "air-paper"], ["air-muted", "air-sky"], ["air-muted", "air-tint"],
    ["air-red", "air-paper"], ["air-red", "air-sky"], ["air-red", "air-tint"], ["white", "air-red"],
    ["air-paper", "air-navy"], ["white", "air-navy"], ["air-navy", "white"], ["air-muted", "white"],
    ["app-accent", "air-paper"], ["app-accent", "air-tint"],
    // A chip waiting on someone, a settled one, and a form's open / always-on pill.
    ["air-navy", "app-pending"], ["air-navy", "app-ok"], ["app-gel-ink", "app-gel"], ["app-gel-green-ink", "app-gel-green"],
  ];
  it.each(pairs)("%s on %s clears AA", (fg, bg) => {
    expect(contrast(t[fg as keyof typeof t], t[bg as keyof typeof t])).toBeGreaterThanOrEqual(AA);
  });

  it("`.air` points danger at wine, so errors clear AA on the stone notices too", () => {
    const css = readFileSync(`${process.cwd()}/src/app/twc-app.css`, "utf8");
    expect(css).toMatch(/\.air \{[^}]*--bl-danger: var\(--bl-air-red\)/);
  });
});

describe("internal-page app shell (app palette)", () => {
  // [text, background, alpha of a tinted background over `app`]: every text pair the app shell (/account, /admin) uses.
  // app = paper cards/sidebar/top bar, app-sunken = cream background, sub-panels, date tiles and notices.
  const pairs: [string, string, number?][] = [
    ["ink", "app"], ["ink", "app-sunken"], ["ink-muted", "app"], ["ink-muted", "app-sunken"], ["app-muted", "app"], ["app-muted", "app-sunken"],
    ["app-accent", "app"], ["app-accent", "app-sunken"], ["danger", "app"], ["danger", "app-sunken"],
    // The current nav pill: paper text on ink.
    ["app", "ink"],
    // Status chips and notices: ink on sun (pending) and mint (ok); danger on cream (declined) is above.
    ["ink", "app-pending"], ["ink", "app-ok"],
    // The gel pill (an open form): its label on the brightest and the palest blue of the gradient.
    ["app-gel-ink", "app-gel"], ["app-gel-ink", "app-gel-soft"],
    ["app-gel-green-ink", "app-gel-green"], ["app-gel-green-ink", "app-gel-green-soft"],
    // Page intros, section heads and their links sit straight on the sage ground (both ends of its gradient).
    // Errors never do: a shell-level alert sits on a paper tile, because danger misses AA on the sage.
    ...["app-ground", "app-ground-warm"].flatMap((g): [string, string][] =>
      ["ink", "ink-muted", "app-muted", "app-accent"].map((fg) => [fg, g])),
  ];

  it.each(["light", "night"] as const)("every text pair clears AA in %s", (mode) => {
    const t = tokens[mode];
    for (const [fg, bg, alpha] of pairs) {
      const back = alpha === undefined ? t[bg] : blend(t[bg], t.app, alpha);
      expect({ fg, bg, ok: contrast(t[fg], back) >= AA }).toEqual({ fg, bg, ok: true });
    }
  });

  it("the internal-tool sources use the tokens, never raw hex or palette colours", () => {
    const read = (f: string) => readFileSync(`${process.cwd()}/${f}`, "utf8");
    const dir = (d: string) => readdirSync(`${process.cwd()}/${d}`).filter((f) => /\.tsx?$/.test(f)).map((f) => `${d}/${f}`);
    const src = [
      ...dir("src/features/account"), ...dir("src/features/feed"), "src/features/admin/panels.tsx", "src/features/forms/FormEditor.tsx",
      "src/features/cal/admin-ui.tsx", "src/routes/_authenticated/directory.tsx", "src/routes/_authenticated/feed.tsx",
      "src/app/layout/AppShell.tsx", "src/app/layout/app-ui.tsx", "src/app/layout/app-classes.ts",
      "src/routes/_authenticated/account.tsx", "src/routes/_authenticated/_admin/admin.tsx",
    ].map(read).join("\n");
    expect(src).toMatch(/text-app-muted/);
    expect(src).toMatch(/text-app-accent/);
    expect(src).toMatch(/bg-air-navy/);
    expect(src).not.toMatch(/app-glass|app-tiles/);
    expect(src).not.toMatch(/(?:bg|text|border|fill|stroke|ring|outline)-\[#|(?:bg|text|border)-(?:zinc|gray|neutral|slate|blue)-\d/);
  });
});

describe("public scrapbook palette (--color-sb-* in styles.css)", () => {
  const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
  const sb: Record<string, string> = {
    ...Object.fromEntries([...css.matchAll(/--color-sb-([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()])),
    white: "#ffffff",
  };
  const twc = readFileSync(`${process.cwd()}/src/app/twc.css`, "utf8");
  const menu = readFileSync(`${process.cwd()}/src/app/layout/SiteMenu.tsx`, "utf8");

  // [text, background]: every colour field keeps ink text (the canvas rule), the role pairs on paper and stone, and
  // cobalt (links, Join) on paper, stone and as a fill under white.
  const fields = ["tomato", "sky", "blush", "butter", "lime", "khaki", "slate", "sage", "lilac", "grey",
    "band-lime", "band-purple", "band-red", "band-butter", "band-grey", "card-ground",
    "ev-green", "ev-mint", "ev-sea", "ev-peri", "ev-sky", "ev-violet"];
  const pairs: [string, string][] = [
    ...fields.map((bg) => ["ink", bg] as [string, string]),
    ["muted", "paper"], ["muted", "cream"], ["blue-ink", "paper"], ["blue-ink", "cream"],
    ["white", "cobalt"], ["white", "wine"], ["danger", "paper"], ["ink", "paper"], ["ink", "cream"],
  ];
  it.each(pairs)("%s on %s clears AA", (fg, bg) => {
    expect(sb[fg]).toBeDefined();
    expect(sb[bg]).toBeDefined();
    expect(contrast(sb[fg], sb[bg])).toBeGreaterThanOrEqual(AA);
  });

  it("sage and tomato fields take ink, never white (white fails AA on both)", () => {
    expect(contrast(sb.white, sb.sage)).toBeLessThan(AA);
    expect(contrast(sb.white, sb.tomato)).toBeLessThan(AA);
    expect(twc).not.toMatch(/\.twc-stamp--(olive|terracotta) \{[^}]*color: #fff;/);
  });

  it("links on any colour field are ink, since cobalt misses AA on several fields", () => {
    const sections = readFileSync(`${process.cwd()}/src/app/twc-sections.css`, "utf8");
    for (const f of ["sky", "band-purple", "sage", "tomato"]) expect(contrast(sb["blue-ink"], sb[f]), f).toBeLessThan(AA);
    expect(sections).toMatch(/\[class\*="twc-c-"\]:not\(\.twc-c-ink\) \.twc-inlink \{ color: var\(--color-sb-ink\); \}/);
  });

  it("field placeholders are the solid muted token, never a fainter blend", () => {
    expect(twc).toMatch(/\.twc-input::placeholder \{ color: var\(--color-sb-muted\); \}/);
  });

  it("an open FAQ's number is ink, which clears AA on stone (and stays so if muted is ever lightened)", () => {
    expect(contrast(sb.ink, sb.cream)).toBeGreaterThanOrEqual(AA);
    expect(twc).toMatch(/\.twc-faq\[open\] \.twc-index \{ color: var\(--color-sb-ink\); \}/);
  });

  it("a neighborhood card's number sits on a paper tag, so any admin-picked colour stays readable", () => {
    const page = readFileSync(`${process.cwd()}/src/routes/neighborhoods.tsx`, "utf8");
    expect(page).toMatch(/<span aria-hidden className="[^"]*bg-sb-paper[^"]*text-sb-ink">\{String\(index\)/);
  });

  it("every event kind field is one of the ink-checked fields above, and a band's small tags sit on paper", () => {
    const pub = readFileSync(`${process.cwd()}/src/app/twc-public.css`, "utf8");
    const kinds = [...pub.matchAll(/\.twc-kind--\d \{ background: var\(--color-sb-([\w-]+)\); \}/g)].map((m) => m[1]);
    expect(kinds).toHaveLength(8);
    for (const k of kinds) expect(fields).toContain(k);
    expect(pub).toMatch(/\.twc-kind \{ background: var\(--color-sb-cream\); color: var\(--color-sb-ink\); \}/);
    expect(pub).toMatch(/\.twc-hband__tag \{[^}]*background: var\(--color-sb-paper\); color: var\(--color-sb-ink\);/);
  });

  it("the home page's colour fields carry ink, and their labels are ink rather than muted", () => {
    const home = readFileSync(`${process.cwd()}/src/routes/index.tsx`, "utf8");
    const homeCss = readFileSync(`${process.cwd()}/src/app/twc-home.css`, "utf8");
    // Bands, experience tiles, the partner strip and the panels: ink on each; the incubator tile is paper on cobalt.
    for (const field of ["band-lime", "band-purple", "sky", "band-butter", "band-red", "ev-green", "ev-mint", "ev-peri", "ev-violet", "ev-sea", "tomato", "blush"]) {
      expect(home + "\n" + homeCss, field).toMatch(new RegExp(`(twc-c-|bg-sb-|--color-sb-)${field}\\b`));
      expect(contrast(sb.ink, sb[field]), field).toBeGreaterThanOrEqual(AA);
    }
    expect(home).toMatch(/bg-sb-cobalt twc-home-tile--dark/);
    expect(homeCss).toMatch(/\.twc-tile\.twc-home-tile--dark \{ color: var\(--color-sb-paper\); \}/);
    expect(contrast(sb.paper, sb.cobalt)).toBeGreaterThanOrEqual(AA);
    // Muted eyebrows fail AA on sky; on the panels they are forced to ink.
    expect(home).toMatch(/twc-panel twc-c-sky">\s*<span className="twc-eyebrow text-sb-ink!"/);
  });

  it("the mobile menu is white, and its decorative ordinals' ink blend clears AA there", () => {
    expect(menu).toMatch(/className="sb-menu bg-sb-paper text-sb-ink"/);
    const ordinal = menu.match(/<span aria-hidden="true" className="[^"]*text-sb-ink\/(\d+)">0\{i \+ 1\}<\/span>/);
    expect(ordinal).not.toBeNull();
    const alpha = Number(ordinal![1]) / 100;
    expect(contrast(blend(sb.ink, sb.paper, alpha), sb.paper)).toBeGreaterThanOrEqual(AA);
  });

  // The form pages (sub-project 3) set ink text on every colour field, and muted words only on paper or stone.
  it("every colour field on the form pages and sign-in is one whose ink pair is checked above", () => {
    const files = [
      "src/routes/join.tsx", "src/routes/review.tsx", "src/routes/spotlight.tsx", "src/routes/contact.tsx", "src/routes/partnerships.tsx",
      "src/routes/f.$slug.tsx", "src/routes/auth.tsx", "src/routes/reset-password.tsx", "src/routes/verified.tsx", "src/app/auth-ui.tsx",
      "src/features/applications/ApplicationForm.tsx", "src/features/applications/AreaChoice.tsx",
      "src/features/member-links/ReviewForm.tsx", "src/features/member-links/SpotlightForm.tsx",
      "src/features/contact/ContactForm.tsx", "src/features/contact/PartnershipForm.tsx", "src/features/forms/CustomForm.tsx",
    ];
    const used = new Set(files.flatMap((f) => [...readFileSync(`${process.cwd()}/${f}`, "utf8").matchAll(/twc-c-([\w-]+)/g)].map((m) => m[1])));
    expect(used.size).toBeGreaterThan(0);
    // stone is sb-cream, checked with ink and muted above.
    expect([...used].filter((c) => c !== "stone" && !fields.includes(c))).toEqual([]);
    const forms = readFileSync(`${process.cwd()}/src/app/twc-forms.css`, "utf8");
    expect(forms).toMatch(/\.twc-fieldc \{[^}]*color: var\(--color-sb-ink\);/);
    expect(forms).toMatch(/\.twc-fieldc \.twc-inlink \{ color: var\(--color-sb-ink\); \}/);
    expect(forms).toMatch(/\.twc-farea \{[^}]*color: var\(--color-sb-ink\);/);
    expect(forms).toMatch(/\.twc-fdone \{[^}]*color: var\(--color-sb-ink\);/);
  });
});
