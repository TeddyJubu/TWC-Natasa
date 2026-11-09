#!/usr/bin/env bun
/**
 * Gate for cutover: every manifest item must be `verified`, and every old static-site
 * HTML page (except the coming-soon homepage) must map to a redirect or a new route.
 *
 * Usage: bun run scripts/migration-check.ts
 * Exit 0 only when the gate passes.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

type ManifestItem = {
  id: string;
  source: string;
  target?: string;
  retired?: boolean | string;
  acceptance: string;
  owner: string;
  status: "todo" | "built" | "verified";
  evidence?: string;
};

type Manifest = { version: number; items: ManifestItem[] };

const ROOT = join(import.meta.dir, "..");
const MANIFEST_PATH = join(ROOT, "migration/manifest.json");
const LEGACY_SITE = join(ROOT, ".migration/legacy/site");
const ROUTES_DIR = join(ROOT, "src/routes");

/** Old pages that stay on the apex (coming soon). */
const KEEP_ON_APEX = new Set(["index.html"]);

/** Old slug → new path (or null when the page is only archived with a generic landing). */
const OLD_TO_NEW: Record<string, string> = {
  "about.html": "/about",
  "contact.html": "/contact",
  "directory.html": "/members",
  "events.html": "/gatherings",
  "fellowship.html": "/fellowship",
  "partnerships.html": "/partnerships",
  "editing.html": "/account",
  "privacy.html": "/privacy",
  "terms.html": "/terms",
  "code-of-conduct.html": "/code-of-conduct",
  "message-sent.html": "/contact",
  "subscribed.html": "/contact",
  "thanks-contact.html": "/contact",
  "thanks-newsletter.html": "/contact",
  "thanks-partnership.html": "/partnerships",
  "404.html": "/404",
};

function fail(msg: string) {
  console.error(`migration-check: ${msg}`);
}

function routeExists(path: string): boolean {
  if (path === "/404") return existsSync(join(ROUTES_DIR, "__root.tsx")); // router default
  const clean = path.replace(/^\//, "").replace(/\/$/, "");
  if (!clean) return existsSync(join(ROUTES_DIR, "index.tsx"));
  const candidates = [
    `${clean}.tsx`,
    `${clean}/index.tsx`,
    `${clean.replace(/\//g, ".")}.tsx`,
    `${clean.replace(/\//g, "_")}.tsx`,
  ];
  return candidates.some((c) => existsSync(join(ROUTES_DIR, c)));
}

function main(): number {
  let errors = 0;

  if (!existsSync(MANIFEST_PATH)) {
    fail(`missing ${MANIFEST_PATH}`);
    return 1;
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    fail("manifest.items is empty — inventorie and seed the manifest before cutover");
    errors++;
  }

  const ids = new Set<string>();
  for (const item of manifest.items) {
    if (!item.id) {
      fail("item missing id");
      errors++;
      continue;
    }
    if (ids.has(item.id)) {
      fail(`duplicate id ${item.id}`);
      errors++;
    }
    ids.add(item.id);
    for (const key of ["source", "acceptance", "owner", "status"] as const) {
      if (!item[key]) {
        fail(`${item.id}: missing ${key}`);
        errors++;
      }
    }
    if (!item.target && !item.retired) {
      fail(`${item.id}: needs target or retired`);
      errors++;
    }
    if (item.status !== "verified") {
      fail(`${item.id}: status is ${item.status ?? "missing"}, want verified`);
      errors++;
    }
    if (item.status === "verified" && !item.evidence) {
      fail(`${item.id}: verified but no evidence`);
      errors++;
    }
  }

  if (existsSync(LEGACY_SITE)) {
    const pages = readdirSync(LEGACY_SITE).filter((f) => f.endsWith(".html"));
    for (const page of pages) {
      if (KEEP_ON_APEX.has(page)) continue;
      const mapped = OLD_TO_NEW[page];
      if (!mapped) {
        fail(`old site page ${page} has no redirect/route mapping`);
        errors++;
        continue;
      }
      const covered =
        routeExists(mapped) ||
        manifest.items.some(
          (i) =>
            i.id.startsWith("SITE-") &&
            (i.source.includes(page) || i.target === mapped) &&
            (i.status === "built" || i.status === "verified"),
        );
      // Gate for URLs: route file must exist OR a verified/built SITE item targets it.
      // Final cutover still requires every item verified above.
      if (!routeExists(mapped) && !covered) {
        fail(`old URL for ${page} → ${mapped}: no route file and no SITE manifest coverage`);
        errors++;
      }
    }
  } else {
    fail(`legacy site snapshot missing at ${LEGACY_SITE} (copy into .migration/legacy first)`);
    errors++;
  }

  if (errors === 0) {
    console.log(`migration-check: ok (${manifest.items.length} items verified)`);
    return 0;
  }
  console.error(`migration-check: ${errors} problem(s)`);
  return 1;
}

process.exit(main());
