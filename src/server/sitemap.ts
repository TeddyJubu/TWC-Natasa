// /sitemap.xml, built per request: the fixed public pages (INDEXED), every active neighborhood, and the members
// whose profile is public — the same rule as publicProfiles() — so a member who turns hers off drops out at once.
import { INDEXED } from "@/app/seo";
import { memberSlug } from "@/features/members/map";
import type { DB } from "./db";

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Entry = { path: string; lastmod?: string };

/**
 * Every indexable path, fixed pages first. A member page carries her profile's updated_at as <lastmod>; the fixed
 * pages and neighborhoods (whose cards change with other members) carry none rather than a guessed date.
 */
export function sitemapEntries(db: DB): Entry[] {
  const hoods = db.prepare("select slug from neighborhoods where active = 1 order by sort_order, name").all() as { slug: string }[];
  const members = db.prepare(
    "select full_name, catalogue_number, updated_at from profiles where status = 'approved' and directory_visible = 1 and public_profile = 1 and catalogue_number is not null order by catalogue_number",
  ).all() as { full_name: string; catalogue_number: number; updated_at: string }[];
  return [
    ...[...INDEXED].map((path) => ({ path })),
    ...hoods.map((h) => ({ path: `/neighborhoods/${h.slug}` })),
    ...members.map((m) => ({
      path: `/members/${memberSlug({ name: m.full_name, catalogueNumber: m.catalogue_number })}`,
      // W3C datetime to the second ("2026-11-11T16:00:00Z").
      lastmod: m.updated_at.replace(/\.\d+Z$/, "Z"),
    })),
  ];
}

/** Every indexable path, fixed pages first. */
export const sitemapPaths = (db: DB): string[] => sitemapEntries(db).map((e) => e.path);

export function sitemapXml(db: DB, origin: string): string {
  const urls = sitemapEntries(db).map(
    (e) => `  <url><loc>${xmlEscape(origin + e.path)}</loc>${e.lastmod ? `<lastmod>${xmlEscape(e.lastmod)}</lastmod>` : ""}</url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
