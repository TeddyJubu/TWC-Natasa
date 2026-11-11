// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import type { Profile } from "@/features/members/queries";
import { renderWithQueries } from "@/test/dom";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));
// The WebGL engine can't run in jsdom.
vi.mock("@/index", async (orig) => ({
  ...(await orig<object>()),
  CurvedGallery: () => <div data-testid="gallery" />,
}));

import { Route as Home } from "@/routes/index";
import { Route as Members } from "@/routes/members";
import { Route as Join } from "@/routes/join";
import { Route as Account } from "@/routes/_authenticated/account";
import { Route as Admin } from "@/routes/_authenticated/_admin/admin";
import { Route as Colors } from "@/routes/colors";
import { Route as Typography } from "@/routes/typography";
import { Route as Components } from "@/routes/components";

vi.spyOn(Account, "useRouteContext").mockReturnValue({ user: { id: "u1" } } as never);
vi.spyOn(Admin, "useRouteContext").mockReturnValue({ user: { id: "u1", email: "rosa@x.test", name: "Rosa Diaz" } } as never);
// Without a loader run, the seeded queries below stand in for the loaders' data.
vi.spyOn(Home, "useLoaderData").mockReturnValue(undefined as never);
vi.spyOn(Members, "useLoaderData").mockReturnValue(undefined as never);
vi.spyOn(Join, "useLoaderData").mockReturnValue({ kind: "application", open: true, closed: null } as never);
afterEach(() => {
  cleanup();
});
type AnyRoute = { options: { component?: unknown; head?: unknown } };
const component = (route: AnyRoute) => route.options.component as React.ComponentType;
const meta = (route: AnyRoute) => ((route.options.head as () => { meta: Record<string, string>[] })().meta);

const profile: Profile = {
  id: "u1", full_name: "Rosa Diaz", role_title: "Founder", business: "Diaz Bakery", neighborhood: "Astoria",
  specialty: "Food", bio: "", looking_for: "", website: "", avatar_path: null, business_logo_url: null, directory_visible: false,
  public_profile: false, status: "approved", catalogue_number: 27, member_since: "2026-01-05T12:00:00Z", card_color: "mustard",
  created_at: "", updated_at: "",
};
const seed: [unknown[], unknown][] = [
  [["viewer"], { signedIn: true, member: true, admin: true }],
  [["public-profiles"], []],
  [["directory"], []],
  [["applicant"], null],
  [["profile", "u1"], { profile, avatarUrl: undefined }],
  [["events"], []],
  [["rsvps", "u1"], []],
  [["booking", "u1"], null],
  [["intros", "u1", "Astoria"], []],
];

const live = {
  "/": Home, "/members": Members, "/join": Join, "/account": Account, "/admin": Admin,
} as const;
const showcase = { "/colors": Colors, "/typography": Typography, "/components": Components } as const;

describe("live pages carry no showcase toolbar", () => {
  for (const [path, route] of Object.entries(live)) {
    it(`${path} renders its site navigation but no dark-theme toggle`, () => {
      const Page = component(route);
      renderWithQueries(<Page />, seed);
      expect(screen.getAllByRole("link", { name: "The Women’s Collective home" })[0].getAttribute("href")).toBe("/");
      expect(screen.queryByRole("button", { name: "Toggle dark theme" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Typography" })).toBeNull();
    });
  }
});

describe("live pages: skip link and one main landmark", () => {
  for (const [path, route] of Object.entries(live)) {
    it(`${path} starts with a skip link to exactly one <main id="main">`, () => {
      const Page = component(route);
      const { container } = renderWithQueries(<Page />, seed);
      const mains = screen.getAllByRole("main");
      expect(mains).toHaveLength(1);
      expect(mains[0].id).toBe("main");
      expect(mains[0].tabIndex).toBe(-1);
      expect(mains[0].className.split(" ")).toContain("outline-none");
      const skip = container.querySelector("a")!;
      expect(skip.textContent).toBe("Skip to content");
      expect(skip.getAttribute("href")).toBe("#main");
      expect(skip.className.split(" ")).toEqual(expect.arrayContaining(["sr-only", "focus:not-sr-only"]));
      // Nav first, footer (when present) last: both outside main.
      expect(mains[0].querySelector("header nav[aria-label='Main']")).toBeNull();
      expect(mains[0].querySelector("footer")).toBeNull();
    });
  }
});

describe("showcase pages keep the toolbar and stay out of search", () => {
  for (const [path, route] of Object.entries(showcase)) {
    it(`${path} renders the dark-theme toggle`, () => {
      const Page = component(route);
      renderWithQueries(<Page />, seed);
      expect(screen.getByRole("button", { name: "Toggle dark theme" })).toBeTruthy();
    });

    it(`${path} is noindex`, () => {
      expect(meta(route)).toContainEqual({ name: "robots", content: "noindex" });
    });
  }

  it("leaving the showcase drops its dark theme, so live pages never inherit it", () => {
    const Page = component(Colors);
    const { unmount } = renderWithQueries(<Page />, seed);
    fireEvent.click(screen.getByRole("button", { name: "Toggle dark theme" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("root route", () => {
  it("stays providers-only: no showcase or page chrome", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).not.toMatch(/@\/showcase|@\/app\/layout\/(AppLayout|StatusPages)|\b(Navbar|Footer|Shell)\b/);
    // Route-change focus is a hook, not markup: the only layout import allowed here.
    // Focus after the new page has rendered: resolvedLocation lags location until lazy chunks and loaders finish.
    expect(root).toMatch(/resolvedLocation/);
    expect(root).toMatch(/useRouteFocus\(resolvedPathname\)/);
  });

  it("does not mount the star ImageTrail (live pages own it via AppPage)", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).not.toMatch(/\bImageTrail\b/);
  });
});

// The legal pages are gone until they're written for real (docs/LEGAL-PAGES-REQUIRED.md): nothing may link them.
describe("AppNav", () => {
  // The desktop row needs ~990px (measured in Gilda Display: links 15px + 0.3px tracking, the 22px wordmark, 36px gaps,
  // Join us); `.twc-wrap` leaves 896px at 1024px and 1024px from 1152px up. So the row starts at xl, with Sign in.
  it("shows the desktop row, Sign in included, only from xl and the menu button below it", () => {
    render(<AppNav />);
    const signIn = screen.getAllByRole("link", { name: "Sign in" });
    const row = screen.getByRole("navigation", { name: "Main" }).parentElement!;
    expect(row.className).toMatch(/(^| )hidden( |$)/);
    expect(row.className).toContain("xl:grid");
    expect(row.className).not.toMatch(/\blg:/);
    const desktopSignIn = signIn.find((a) => row.contains(a))!;
    expect(desktopSignIn.className).not.toMatch(/hidden|min-\[/);
    const bar = screen.getByRole("button", { name: "Open menu" }).closest("div.flex.min-h-16")!;
    expect(bar.className).toContain("xl:hidden");
    expect(bar.className).not.toContain("lg:hidden");
  });
});

describe("AppFooter", () => {
  const REMOVED = ["/privacy", "/terms", "/code-of-conduct"];
  it("the router has no legal routes, so they 404", () => {
    const tree = readFileSync(resolve(process.cwd(), "src/routeTree.gen.ts"), "utf8");
    expect(tree).toMatch(/path: '\/about'/);
    for (const path of REMOVED) expect(tree).not.toContain(`path: '${path}'`);
  });

  it("carries no legal links while the legal pages are removed", () => {
    render(<AppFooter />);
    expect(screen.queryByRole("navigation", { name: "Legal" })).toBeNull();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href")).filter((h) => REMOVED.includes(h ?? ""))).toEqual([]);
  });

  for (const [path, route] of Object.entries(live)) {
    it(`${path} links none of the removed legal pages`, () => {
      const Page = component(route);
      const { container } = renderWithQueries(<Page />, seed);
      const hrefs = [...container.querySelectorAll("a")].map((a) => (a.getAttribute("href") ?? "").split("#")[0]);
      expect(hrefs.filter((h) => REMOVED.includes(h))).toEqual([]);
    });
  }
});

describe("AppPage", () => {
  it("hosts the decorative ImageTrail (shown for a fine, hovering pointer)", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("pointer: fine"), media: query, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
    }));
    try {
      render(<AppPage><p>Body</p></AppPage>);
      await act(async () => {});
      expect(document.querySelector(".image-trail img")).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("account-access pages use the site chrome", () => {
  // AuthFrame is AppPage → AppNav → main → AppFooter, so they get the skip link and the trail from AppPage.
  it("AuthFrame wraps AppPage, AppNav and AppFooter", () => {
    expect(readFileSync(resolve(process.cwd(), "src/app/auth-ui.tsx"), "utf8")).toMatch(/<AppPage>\s*<AppNav \/>[\s\S]*<AppFooter \/>\s*<\/AppPage>/);
  });
  it.each(["src/routes/auth.tsx", "src/routes/reset-password.tsx", "src/routes/verified.tsx"])("%s renders in AuthFrame, not its own trail", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).toMatch(/<AuthFrame>/);
    expect(source).not.toMatch(/\bImageTrail\b/);
  });
});

describe("robots.txt", () => {
  const robots = () => readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");
  const rules = () => robots().split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  const values = (field: string) => rules().filter((l) => l.startsWith(`${field}:`)).map((l) => l.slice(field.length + 1).trim());

  it("disallows the showcase, personal links, the API, server functions and the private media buckets", () => {
    expect(values("Disallow").sort()).toEqual(["/_serverFn/", "/api/", "/colors", "/components", "/media/avatars/", "/media/feed/", "/review", "/spotlight", "/typography"]);
    expect(values("Allow")).toEqual(["/"]);
  });

  it("keeps public portraits, neighborhood logos and the signed-in pages' noindex header reachable", () => {
    // A Disallow would hide the signed-in pages' X-Robots-Tag: noindex (security-headers.ts) from crawlers.
    for (const path of ["/media/public/", "/media/neighborhood-logos/", "/account", "/directory", "/feed", "/admin"]) {
      expect(values("Disallow").some((d) => path.startsWith(d))).toBe(false);
    }
  });

  it("names every search and answer crawler in the one group with *, so they share its rules", () => {
    // RFC 9309: a crawler follows only the group that names it, so a separate group would lose *'s Disallows.
    const lines = rules();
    const firstRule = lines.findIndex((l) => !l.startsWith("User-agent:"));
    expect(lines.slice(firstRule).some((l) => l.startsWith("User-agent:"))).toBe(false);
    expect(values("User-agent")).toEqual([
      "*", "Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot",
      "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended",
    ]);
  });
});
