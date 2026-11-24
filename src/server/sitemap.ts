// /sitemap.xml, built per request: the fixed public pages (INDEXED), every active neighborhood and the public
// events. No member pages: the directory is members-only (owner decision, 2026-11-24).
import { INDEXED } from "@/app/seo";
import type { DB } from "./db";

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Entry = { path: string };

/** Every indexable path, fixed pages first, with no <lastmod> rather than a guessed date. */
export function sitemapEntries(db: DB, events: { slug: string; updated: string }[] = []): Entry[] {
  const hoods = db.prepare("select slug from neighborhoods where active = 1 order by sort_order, name").all() as { slug: string }[];
  return [
    ...[...INDEXED].map((path) => ({ path })),
    ...hoods.map((h) => ({ path: `/neighborhoods/${h.slug}` })),
    ...events.map((e) => ({ path: `/events/${encodeURIComponent(e.slug)}` })),
  ];
}

/** Every indexable path, fixed pages first. */
export const sitemapPaths = (db: DB): string[] => sitemapEntries(db).map((e) => e.path);

export function sitemapXml(db: DB, origin: string, events: { slug: string; updated: string }[] = []): string {
  const urls = sitemapEntries(db, events).map(
    (e) => `  <url><loc>${xmlEscape(origin + e.path)}</loc></url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
