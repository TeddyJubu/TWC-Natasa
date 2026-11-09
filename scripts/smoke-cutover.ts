#!/usr/bin/env bun
/**
 * Smoke the vps-cutover redirects (migration/caddy-twc-redirects.caddy) against the live hosts.
 * Every page row of migration/redirects.md, tidy and `.html`, plus the host redirects.
 *
 * Usage: bun scripts/smoke-cutover.ts [--form <live-old-slug>]
 *   SMOKE_CONNECT=http://127.0.0.1:18080  send each request there with the real Host header
 *                                         (a local Caddy run of the patched file).
 * Read-only: GETs only, never posts a form. Exit 1 on any mismatch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const NEW = "https://new.thewomenscollective.club";
const APEX = "thewomenscollective.club";
const BAD_TOKEN = "smoke-not-a-token";

/** `[tidy, .html, new path]` for each "Pages" row of redirects.md that redirects (not `/`, not 404). */
export function pageRows(md: string): [string, string, string][] {
  return [...md.matchAll(/^\| `(\/[^`]*)` \| `(\/[^`]*)` \| `(\/[^`]*)` \|/gm)].map(
    (m) => [m[1], m[2], m[3]] as [string, string, string],
  );
}

type Check = { host: string; path: string; status: number; location?: string };

export function checks(md: string, formSlug?: string): Check[] {
  const to = (location: string, status = 301) => ({ status, location });
  const list: Check[] = pageRows(md).flatMap(([tidy, html, path]) =>
    [tidy, html].map((p) => ({ host: APEX, path: p, ...to(NEW + path) })),
  );
  list.push(
    { host: APEX, path: "/", status: 200 },
    { host: APEX, path: "/index.html", ...to("/") },
    { host: APEX, path: "/about.html?form=x", ...to(`${NEW}/about`) }, // query dropped
    { host: APEX, path: "/404", status: 404 },
    { host: APEX, path: "/404.html", status: 404 },
    { host: APEX, path: "/apply", ...to(`${NEW}/join`) },
    { host: APEX, path: "/apply.html", ...to(`${NEW}/join`) },
    { host: APEX, path: "/login", ...to(`${NEW}/auth`, 302) },
    { host: APEX, path: "/members/old-page", ...to(`${NEW}/members`, 302) },
    { host: APEX, path: "/apply-thank-you", ...to("/", 302) },
    { host: "join.thewomenscollective.club", path: "/join", ...to(`${NEW}/join`) },
    { host: "members.thewomenscollective.club", path: "/join", ...to(`${NEW}/join`) },
    { host: "members.thewomenscollective.club", path: `/review?t=${BAD_TOKEN}`, ...to(`${NEW}/review?t=${BAD_TOKEN}`) },
    { host: "members.nbwc.site", path: `/review?t=${BAD_TOKEN}`, ...to(`${NEW}/review?t=${BAD_TOKEN}`) },
    { host: "members.thewomenscollective.club", path: `/spotlight?t=${BAD_TOKEN}`, ...to(`${NEW}/spotlight?t=${BAD_TOKEN}`) },
    { host: "members.nbwc.site", path: `/spotlight?t=${BAD_TOKEN}`, ...to(`${NEW}/spotlight?t=${BAD_TOKEN}`) },
    { host: "join.nbwc.site", path: "/", ...to(`${NEW}/join`) },
    { host: "forms.nbwc.site", path: "/", ...to(`${NEW}/join`) },
    { host: "nbwc.site", path: "/apply", ...to(`${NEW}/join`) },
    // The app's own answer for a bad link: the one neutral 404 (members-links).
    { host: "new.thewomenscollective.club", path: `/review?t=${BAD_TOKEN}`, status: 404 },
    { host: "new.thewomenscollective.club", path: `/spotlight?t=${BAD_TOKEN}`, status: 404 },
    // admin.*/crm.* → /admin (twc_admin_cutover / twc_crm_cutover) — enabled 2026-11-09.
    { host: "admin.thewomenscollective.club", path: "/", ...to(`${NEW}/admin`) },
    { host: "admin.thewomenscollective.club", path: "/login", ...to(`${NEW}/admin`) },
    { host: "crm.thewomenscollective.club", path: "/", ...to(`${NEW}/admin`) },
    { host: "crm.thewomenscollective.club", path: "/v2", ...to(`${NEW}/admin`) },
  );
  // /f/* stays on the old stack until forms-import lands (redirects.md "Not redirected yet").
  if (formSlug) list.push({ host: APEX, path: `/f/${formSlug}`, status: 200 });
  return list;
}

async function main(): Promise<number> {
  const md = readFileSync(join(import.meta.dirname, "../migration/redirects.md"), "utf8");
  const at = process.argv.indexOf("--form");
  const connect = process.env.SMOKE_CONNECT;
  let bad = 0;
  for (const c of checks(md, at > 0 ? process.argv[at + 1] : undefined)) {
    const url = connect ? connect + c.path : `https://${c.host}${c.path}`;
    const res = await fetch(url, { redirect: "manual", headers: connect ? { host: c.host } : {} });
    const loc = res.headers.get("location") ?? undefined;
    const ok = res.status === c.status && (c.location === undefined || loc === c.location);
    if (!ok) bad++;
    const want = ok ? "" : `  (want ${c.status}${c.location ? ` ${c.location}` : ""})`;
    console.log(`${ok ? "ok  " : "FAIL"} ${c.host}${c.path} → ${res.status}${loc ? ` ${loc}` : ""}${want}`);
  }
  console.log(bad ? `smoke-cutover: ${bad} failed` : "smoke-cutover: ok");
  return bad ? 1 : 0;
}

if (process.argv[1]?.endsWith("smoke-cutover.ts")) process.exit(await main());
