// public/llms.txt and llms-full.txt: links only to indexed public pages on the site's origin, and the FAQ in the full
// file is word for word the one on /faq, so neither can drift into facts the site doesn't state.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDEXED } from "./seo";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const SITE = read(".env").match(/^VITE_SITE_URL=(.+)$/m)?.[1].trim() ?? "";
const links = (text: string) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
const OWN_FILES = new Set(["/llms.txt", "/llms-full.txt", "/sitemap.xml"]);

describe.each(["public/llms.txt", "public/llms-full.txt"])("%s", (file) => {
  const text = read(file);

  it("starts with the site's name as its one h1 and a summary blockquote", () => {
    expect(text.startsWith("# The Women’s Collective\n\n> ")).toBe(true);
    expect(text.match(/^# /gm)).toHaveLength(1);
  });

  it("links only to indexed public pages (and these files) on the site's origin", () => {
    expect(SITE).toMatch(/^https:\/\//);
    const found = links(text);
    expect(found.length).toBeGreaterThan(0);
    for (const href of found) {
      expect(href.startsWith(`${SITE}/`)).toBe(true);
      const path = href.slice(SITE.length);
      expect(INDEXED.has(path) || OWN_FILES.has(path)).toBe(true);
      expect(path).not.toMatch(/^\/(auth|account|admin|directory|feed)(\/|$)/);
    }
  });
});

describe("llms-full.txt's questions", () => {
  // Each { q, a, link? } in faq.tsx's FAQ_GROUPS, rendered the way llms-full.txt writes it.
  const faq = [...read("src/routes/faq.tsx").matchAll(/\{ q: "([^"]+)", a: "([^"]+)"(?:, link: \{ text: "([^"]+)", to: "([^"]+)", after: "([^"]*)" \})? \}/g)];
  const full = read("public/llms-full.txt");

  it("are every FAQ question with its answer word for word", () => {
    expect(faq.length).toBeGreaterThanOrEqual(10);
    for (const [, q, a, text, to, after] of faq) {
      const answer = text ? `${a}[${text}](${SITE}${to})${after}` : a;
      expect(full).toContain(`### ${q}\n\n${answer}\n`);
    }
    expect(full.match(/^### /gm)).toHaveLength(faq.length);
  });
});
