// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { INDEXED } from "./seo";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route as Privacy } from "@/routes/privacy";
import { Route as Terms } from "@/routes/terms";
import { Route as Conduct } from "@/routes/code-of-conduct";

afterEach(cleanup);

type AnyRoute = { options: { component?: unknown; head?: unknown } };
const meta = (route: AnyRoute) => (route.options.head as () => { meta: Record<string, string>[] })().meta;
const show = (route: AnyRoute) => {
  const Page = route.options.component as React.ComponentType;
  return renderWithQueries(<Page />);
};
const text = () => screen.getByRole("main").textContent ?? "";

const pages = [
  ["/privacy", Privacy, "What we hold, and why", "Privacy Policy — The Women’s Collective"],
  ["/terms", Terms, "The short version", "Terms of Membership — The Women’s Collective"],
  ["/code-of-conduct", Conduct, "What we expect of each other", "Code of Conduct — The Women’s Collective"],
] as const;

describe.each(pages)("%s", (path, route, h1, title) => {
  it("has its own title and description, and is listed for search", () => {
    expect(meta(route)).toContainEqual({ title });
    expect(meta(route).find((m) => m.name === "description")?.content).toBeTruthy();
    expect(INDEXED.has(path)).toBe(true);
  });

  it("opens with document tabs and one serif h1, then numbered sections, with no skipped levels", () => {
    show(route);
    const main = screen.getByRole("main");
    expect(main.id).toBe("main");
    expect(within(main).getByRole("heading", { level: 1 }).textContent).toBe(h1);
    const sections = within(main).getAllByRole("heading", { level: 2 }).filter((h) => /^\d{2} /.test(h.textContent ?? ""));
    expect(sections.map((h) => Number.parseInt(h.textContent!))).toEqual(sections.map((_, i) => i + 1));
    expectNoSkippedHeadings(main);
  });

  it("tabs between the three documents, marking this one as the current page", () => {
    show(route);
    const tabs = within(screen.getByRole("navigation", { name: "Legal documents" })).getAllByRole("link");
    expect(tabs.map((a) => a.getAttribute("href"))).toEqual(["/privacy", "/terms", "/code-of-conduct"]);
    expect(tabs.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.getAttribute("href"))).toEqual([path]);
  });

  it("lists every section under “On this page”, each link landing on its section", () => {
    show(route);
    const toc = screen.getByRole("navigation", { name: "On this page" });
    const links = within(toc).getAllByRole("link");
    expect(links.length).toBe(screen.getAllByRole("heading", { level: 2 }).filter((h) => /^\d{2} /.test(h.textContent ?? "")).length);
    for (const link of links) {
      const target = document.getElementById(link.getAttribute("href")!.replace(/^#/, ""));
      expect(target, link.textContent!).not.toBeNull();
      expect(target!.tagName).toBe("SECTION");
      expect(target!.querySelector("h2")?.textContent).toMatch(/^\d{2} /);
    }
  });

  it("keeps the draft notes visible and is dated 8 November 2026", () => {
    show(route);
    expect(screen.getByRole("heading", { name: /^TEMPLATE — / })).toBeTruthy();
    expect(text()).toMatch(/\[[A-Z][A-Z ’'-]+\]/); // a bracketed placeholder or note
    expect(text()).toContain("Last updated 8 November 2026");
  });

  it("points nowhere that no longer exists", () => {
    show(route);
    for (const a of screen.getByRole("main").querySelectorAll("a")) expect(a.getAttribute("href")).not.toMatch(/\.html$/);
    expect(text()).not.toMatch(/contact form|contact page|Fellowship|Architecture plan/);
  });
});

describe("what the pages say about the system", () => {
  it("privacy names what actually runs: Cloudflare, Cloudflare Email Sending, self-hosted fonts and images, one session cookie", () => {
    show(Privacy);
    const t = text();
    for (const gone of ["Google Fonts", "Pexels", "Every export", "passes the message along", "asks search engines not to index", "the date of your last sign-in", "stored beside it"]) {
      expect(t).not.toContain(gone);
    }
    expect(t).toContain("Cloudflare Email Sending");
    expect(t).toContain("better-auth.session_token");
    expect(t).toContain("can appear in search engines");
    expect(t).toMatch(/not stored/);
    expect(screen.getByRole("link", { name: "code of conduct" }).getAttribute("href")).toBe("/code-of-conduct");
  });

  it("terms: leaving is by email, and the code of conduct link is the new route", () => {
    show(Terms);
    expect(text()).toContain("by writing to [CONTACT EMAIL]");
    expect(text()).not.toContain("from your profile page");
    expect(screen.getByRole("link", { name: "code of conduct" }).getAttribute("href")).toBe("/code-of-conduct");
  });

  it("code of conduct: reports go to the reporting address, with no form to choose from", () => {
    show(Conduct);
    expect(text()).toContain("[REPORTING EMAIL ADDRESS]");
    expect(text()).not.toContain("choose Reporting conduct");
    expect(text()).not.toContain("messages sent through this site");
  });
});
