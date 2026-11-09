// /sitemap.xml, built per request: the fixed public pages (INDEXED), every active neighborhood, and the members
// whose profile is public — the same rule as publicProfiles() — so a member who turns hers off drops out at once.
import { INDEXED } from "@/app/seo";
import { memberSlug } from "@/features/members/map";
import type { DB } from "./db";

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Every indexable path, fixed pages first. */
export function sitemapPaths(db: DB): string[] {
  const hoods = db.prepare("select slug from neighborhoods where active = 1 order by sort_order, name").all() as { slug: string }[];
  const members = db.prepare(
    "select full_name, catalogue_number from profiles where status = 'approved' and directory_visible = 1 and public_profile = 1 and catalogue_number is not null order by catalogue_number",
  ).all() as { full_name: string; catalogue_number: number }[];
  return [
    ...INDEXED,
    ...hoods.map((h) => `/neighborhoods/${h.slug}`),
    ...members.map((m) => `/members/${memberSlug({ name: m.full_name, catalogueNumber: m.catalogue_number })}`),
  ];
}

export function sitemapXml(db: DB, origin: string): string {
  const urls = sitemapPaths(db).map((p) => `  <url><loc>${xmlEscape(origin + p)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
