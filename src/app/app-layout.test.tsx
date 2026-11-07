// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { Profile } from "@/features/members/queries";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);
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
afterEach(() => {
  cleanup();
  fake.reset();
});

type AnyRoute = { options: { component?: unknown; head?: unknown } };
const component = (route: AnyRoute) => route.options.component as React.ComponentType;
const meta = (route: AnyRoute) => ((route.options.head as () => { meta: Record<string, string>[] })().meta);

const profile: Profile = {
  id: "u1", full_name: "Rosa Diaz", role_title: "Founder", business: "Diaz Bakery", neighborhood: "Astoria",
  specialty: "Food", bio: "", looking_for: "", website: "", avatar_path: null, directory_visible: false,
  public_profile: false, status: "approved", catalogue_number: 27, member_since: "2026-01-05T12:00:00Z",
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

const live = { "/": Home, "/members": Members, "/join": Join, "/account": Account, "/admin": Admin } as const;
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
  it("stays providers-only: no showcase or page chrome (preview routes render inside it)", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).not.toMatch(/@\/showcase|@\/app\/layout|\b(Navbar|Footer|Shell)\b/);
  });
});

describe("robots.txt", () => {
  const robots = () => readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");

  it("applies to every crawler and disallows the showcase and preview paths", () => {
    const lines = robots().split("\n").map((l) => l.trim());
    expect(lines).toContain("User-agent: *");
    const disallowed = lines.filter((l) => l.startsWith("Disallow:")).map((l) => l.slice("Disallow:".length).trim());
    expect(disallowed.sort()).toEqual(["/__component", "/__mockup", "/colors", "/components", "/typography"]);
  });
});
