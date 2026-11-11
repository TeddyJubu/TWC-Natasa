#!/usr/bin/env bun
/**
 * Smoke the vps-cutover redirects (migration/caddy-twc-redirects.caddy) against the live hosts.
 * Every page row of migration/redirects.md, tidy and `.html`, plus the host redirects.
 *
 * Usage: bun scripts/smoke-cutover.ts [--form <live-old-slug>]
 *   SMOKE_CONNECT=http://127.0.0.1:18080  send each request there with the real Host header
 *                                         (a local Caddy run of the patched file).
 * Also checks the CSP nonce on the new host's `/`: every inline script must carry the header's nonce, or the page
 * doesn't hydrate (run it again after deploy, through Cloudflare, so a zone feature injecting scripts shows up).
 * Also scans the HTML of a few pages on each public host for injected markup (`injectionProblems`): an inline script
 * that isn't the app's own (the CSP nonce, or JSON-LD data; on the apex's no-nonce static pages, a body hash in
 * `STATIC_SCRIPTS`), or a `href`/`src`/`action` to a host outside `KNOWN_HOSTS` (plus `STATIC_HOSTS` on those static
 * pages; add more for one run with SMOKE_ALLOW_HOSTS=a.com,b.org). `--launch` (once SITE_PIN is gone) also
 * fails on any `X-Robots-Tag` on the apex and new.* home pages.
 *   SMOKE_PIN=<the preview PIN>  while SITE_PIN is set: send the PIN cookie to new.*, so the nonce, 404 and HTML rows
 *                                see the app's pages instead of the PIN page.
 * Read-only: GETs only, never posts a form. Exit 1 on any mismatch.
 */
import { createHash } from "node:crypto";
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
    // SITE-118/167: enabled 2026-11-09 — old directory portraits 404 on apex.
    { host: APEX, path: "/assets/img/directory/smoke-not-a-file.jpg", status: 404 },
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

/**
 * What's wrong with a page's inline scripts under its CSP: no `'nonce-…'` in script-src, or an inline script (no src,
 * not JSON-LD data) whose nonce isn't it. Empty means every inline script runs.
 */
export function nonceProblems(html: string, csp: string | null): string[] {
  const nonce = /script-src[^;]*'nonce-([^']+)'/.exec(csp ?? "")?.[1];
  if (!nonce) return ["no 'nonce-…' in the Content-Security-Policy script-src"];
  const problems: string[] = [];
  for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (/\ssrc=/i.test(attrs) || /type=["']?application\/ld\+json/i.test(attrs)) continue;
    const got = /\snonce=["']?([^"'\s>]+)/i.exec(attrs)?.[1];
    if (got !== nonce) problems.push(`inline <script${attrs}> ${got ? `has nonce ${got}` : "has no nonce"}`);
  }
  return problems;
}

/** Hosts our pages may link to or load from (a subdomain of one counts as it). */
export const KNOWN_HOSTS = [
  "thewomenscollective.club",
  "thewomenscollective.nyc",
  "natasatuohy.com",
  "instagram.com",
  "doop.design",
  "openfreemap.org",
  "openmaptiles.org",
  "openstreetmap.org",
];

/** Hosts the apex's old static pages (`/opt/nbwc/site`) load from or link to, and only they: fonts, stock photos,
 * Turnstile and the Facebook link. */
export const STATIC_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "images.pexels.com",
  "challenges.cloudflare.com",
  "facebook.com",
];

/** SHA-256 (hex, of the trimmed body) of the inline scripts the apex's static pages carry themselves (no nonce there):
 * the dark-theme snippet and the inlined `assets/js/site.js` of index.html and of 404.html. */
export const STATIC_SCRIPTS = [
  "3d02471ef86e1f4d290926d0496f37e7b51147e40290f0e46526ded480fe80e6",
  "549c764e45f2ef38c800bca82db57786e8f8587e338e109e7c460a2611916671",
  "03b2e7a3fcfb9a48f53bd2f7f4aff7ba75a42f55c31a765e20465b8643afd3bf",
];

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The `twc_pin` cookie value for a PIN: the same hash `src/server/site-pin.ts` sets (checked by its test). */
export const pinCookie = (pin: string) => sha256(`twc-site-pin:${pin}`);

/**
 * Markup on a page that didn't come from us: an inline script (no src, not JSON-LD) that doesn't carry the CSP's
 * nonce (with no nonce in the CSP, any inline script whose body hash isn't in `scripts`), or a `href`/`src`/`action` to
 * an absolute or protocol-relative URL whose host isn't in `allowed` or under one of them. Scans the raw HTML, so a
 * link inside an injected script's string counts too.
 */
export function injectionProblems(
  html: string,
  csp: string | null,
  allowed: readonly string[] = KNOWN_HOSTS,
  scripts: readonly string[] = [],
): string[] {
  const nonce = /script-src[^;]*'nonce-([^']+)'/.exec(csp ?? "")?.[1];
  const problems: string[] = [];
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)(?:<\/script\s*>|$)/gi)) {
    if (/\ssrc=/i.test(attrs) || /type=["']?application\/ld\+json/i.test(attrs)) continue;
    const got = /\snonce=["']?([^"'\s>]+)/i.exec(attrs)?.[1];
    if (nonce && got === nonce) continue;
    const hash = sha256(body.trim());
    if (!nonce && scripts.includes(hash)) continue;
    problems.push(`inline <script${attrs}> is not the app's bootstrap (sha256 ${hash})`);
  }
  const hosts = new Set<string>();
  for (const [, url] of html.matchAll(/\b(?:href|src|action)\s*=\s*\\?["']?((?:https?:)?\/\/[^"'\s>\\]+)/gi)) {
    let host: string;
    try {
      host = new URL(url, "https://x.invalid").hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) hosts.add(host);
  }
  for (const host of hosts) problems.push(`links to unknown host ${host}`);
  return problems;
}

/** Pages whose HTML `injectionProblems` scans: the home page and one other page on each public host. `static`: one of
 * the apex's old static pages, which may also use `STATIC_HOSTS` and `STATIC_SCRIPTS`. */
export const HTML_PAGES: { host: string; path: string; static?: boolean }[] = [
  { host: "new.thewomenscollective.club", path: "/" },
  { host: "new.thewomenscollective.club", path: "/about" },
  { host: APEX, path: "/", static: true },
  { host: APEX, path: "/404.html", static: true },
];

async function main(): Promise<number> {
  const md = readFileSync(join(import.meta.dirname, "../migration/redirects.md"), "utf8");
  const at = process.argv.indexOf("--form");
  const connect = process.env.SMOKE_CONNECT;
  const pin = process.env.SMOKE_PIN;
  const newHost = new URL(NEW).host;
  /** Request headers for a host: the real Host when connecting elsewhere, and the PIN cookie for new.*. */
  const headersFor = (host: string): Record<string, string> => ({
    ...(connect ? { host } : {}),
    ...(pin && host === newHost ? { cookie: `twc_pin=${pinCookie(pin)}` } : {}),
  });
  let bad = 0;
  for (const c of checks(md, at > 0 ? process.argv[at + 1] : undefined)) {
    const url = connect ? connect + c.path : `https://${c.host}${c.path}`;
    const res = await fetch(url, { redirect: "manual", headers: headersFor(c.host) });
    const loc = res.headers.get("location") ?? undefined;
    const ok = res.status === c.status && (c.location === undefined || loc === c.location);
    if (!ok) bad++;
    const want = ok ? "" : `  (want ${c.status}${c.location ? ` ${c.location}` : ""})`;
    console.log(`${ok ? "ok  " : "FAIL"} ${c.host}${c.path} → ${res.status}${loc ? ` ${loc}` : ""}${want}`);
  }
  const home = connect ? `${connect}/` : `${NEW}/`;
  const res = await fetch(home, { headers: headersFor(newHost) });
  const problems = nonceProblems(await res.text(), res.headers.get("content-security-policy"));
  bad += problems.length;
  for (const p of problems) console.log(`FAIL ${NEW}/ CSP nonce: ${p}`);
  if (!problems.length) console.log(`ok   ${NEW}/ every inline script carries the CSP nonce`);
  const allowed = [...KNOWN_HOSTS, ...(process.env.SMOKE_ALLOW_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean)];
  const launch = process.argv.includes("--launch");
  for (const page of HTML_PAGES) {
    const url = connect ? connect + page.path : `https://${page.host}${page.path}`;
    const r = await fetch(url, { headers: headersFor(page.host) });
    const found = page.static
      ? injectionProblems(await r.text(), r.headers.get("content-security-policy"), [...allowed, ...STATIC_HOSTS], STATIC_SCRIPTS)
      : injectionProblems(await r.text(), r.headers.get("content-security-policy"), allowed);
    const robots = r.headers.get("x-robots-tag");
    if (launch && page.path === "/" && robots) found.push(`X-Robots-Tag: ${robots}`);
    bad += found.length;
    for (const p of found) console.log(`FAIL ${page.host}${page.path} ${p}`);
    if (!found.length) console.log(`ok   ${page.host}${page.path} no injected scripts or unknown hosts`);
  }
  console.log(bad ? `smoke-cutover: ${bad} failed` : "smoke-cutover: ok");
  return bad ? 1 : 0;
}

if (process.argv[1]?.endsWith("smoke-cutover.ts")) process.exit(await main());
