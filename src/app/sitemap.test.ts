import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDEXED } from "./seo";
import { openDb } from "@/server/db";
import { sitemapPaths, sitemapXml } from "@/server/sitemap";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function seeded() {
  const db = openDb(":memory:");
  const member = (id: string, name: string, flags: { approved?: boolean; listed?: boolean; isPublic?: boolean }) => {
    const now = new Date().toISOString();
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, 1, ?, ?)`).run(id, name, `${id}@x.test`, now, now);
    db.prepare("update profiles set directory_visible = ?, public_profile = ? where id = ?").run(flags.listed ? 1 : 0, flags.isPublic ? 1 : 0, id);
    if (flags.approved) db.prepare("update profiles set status = 'approved' where id = ?").run(id);
  };
  member("a", "Rosa Díaz", { approved: true, listed: true, isPublic: true });
  member("b", "Listed Only", { approved: true, listed: true });
  member("c", "Pending Public", { listed: true, isPublic: true });
  db.prepare("update neighborhoods set active = 0 where slug = 'rego-park'").run();
  return db;
}

describe("/sitemap.xml", () => {
  it("lists the fixed pages, active neighborhoods and only fully public members", () => {
    const paths = sitemapPaths(seeded());
    expect(paths.slice(0, INDEXED.size)).toEqual([...INDEXED]);
    expect(paths).toContain("/neighborhoods/astoria");
    expect(paths).not.toContain("/neighborhoods/rego-park");
    const members = paths.filter((p) => p.startsWith("/members/"));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatch(/^\/members\/rosa-diaz-\d+$/);
  });

  it("is absolute URLs on the given origin", () => {
    const xml = sitemapXml(seeded(), "https://new.thewomenscollective.club");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs[0]).toBe("https://new.thewomenscollective.club/");
    expect(locs.every((l) => l.startsWith("https://new.thewomenscollective.club/"))).toBe(true);
  });

  it("is no longer a static file that would shadow the route", () => {
    expect(() => read("public/sitemap.xml")).toThrow();
  });

  it("is announced in robots.txt", () => {
    expect(read("public/robots.txt")).toMatch(/^Sitemap: https:\/\/new\.thewomenscollective\.club\/sitemap\.xml$/m);
  });

  it("matches VITE_SITE_URL in the tracked .env", () => {
    expect(read(".env")).toMatch(/^VITE_SITE_URL=https:\/\/new\.thewomenscollective\.club$/m);
  });
});
