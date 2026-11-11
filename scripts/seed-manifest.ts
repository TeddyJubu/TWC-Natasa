#!/usr/bin/env bun
/**
 * Seeds migration/manifest.json from inventory markdown files.
 * Re-runnable: preserves status/evidence for ids that already exist when --preserve is set.
 *
 * Usage: bun run scripts/seed-manifest.ts [--preserve]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Status = "todo" | "built" | "verified";
type Item = {
  id: string;
  source: string;
  target?: string;
  retired?: string;
  acceptance: string;
  owner: string;
  status: Status;
  evidence?: string;
};

const ROOT = join(import.meta.dir, "..");
const INV = join(ROOT, "migration/inventory");
const OUT = join(ROOT, "migration/manifest.json");
const preserve = process.argv.includes("--preserve");

const OWNERS = [
  "public-pages",
  "data-import",
  "admin-inbox",
  "members-links",
  "custom-forms",
  "notifications",
  "vps-cutover",
] as const;

const OLD_TO_NEW: Record<string, string> = {
  "about.html": "/about",
  "contact.html": "/contact",
  "directory.html": "/members",
  "events.html": "/gatherings",
  "fellowship.html": "/fellowship",
  "partnerships.html": "/partnerships",
  "editing.html": "/account",
  "message-sent.html": "/contact",
  "subscribed.html": "/contact",
  "thanks-contact.html": "/contact",
  "thanks-newsletter.html": "/contact",
  "thanks-partnership.html": "/partnerships",
  "404.html": "/404",
  "index.html": "retired:apex-coming-soon",
};

/** Bold-title form: `- **OPS-001** (A-01) **Process model**: …` */
const ITEM_BOLD_TITLE =
  /^- \*\*((?:SITE|CRM|OPS)-\d+)\*\*(?:\s+\([^)]+\))?\s+\*\*([^*]+)\*\*:?\s*(.*)$/;
/** Plain form: `- **OPS-103** (B-01) The application has…` */
const ITEM_PLAIN =
  /^- \*\*((?:SITE|CRM|OPS)-\d+)\*\*(?:\s+\([^)]+\))?\s+(.+)$/;

function ownerFromCrmBracket(line: string): string | null {
  const m = line.match(/\[([a-z-]+)\]\s*$/);
  if (!m) return null;
  return OWNERS.includes(m[1] as (typeof OWNERS)[number]) || m[1] === "retired" ? m[1]! : null;
}

function assignOwner(id: string, title: string, body: string): string {
  const t = `${title} ${body}`.toLowerCase();
  if (id.startsWith("SITE-")) {
    if (/caddy|redirect|apex|archive|vps|robots\.txt|sitemap\.xml \(old\)|try_files|@nologin/.test(t)) {
      return "vps-cutover";
    }
    if (/newsletter|beehiiv|confirm|notify|email|turnstile|spam|webhook|notion sync/.test(t)) {
      if (/form|honeypot|consent|topic|partnership form|contact form|storage|inbox|message/.test(t)) {
        return /newsletter|beehiiv|confirm/.test(t) ? "notifications" : "admin-inbox";
      }
    }
    if (/contact message|storage|inbox|honeypot|partnership inquiry|api\/contact|api\/partnership/.test(t)) {
      return "admin-inbox";
    }
    if (/import|subscriber|128|120|44|jsonl/.test(t)) return "data-import";
    return "public-pages";
  }
  if (id.startsWith("CRM-")) {
    if (/member link|review link|spotlight|staging_links|token/.test(t)) return "members-links";
    if (/custom form|form builder|\/f\/|look |funnel|held|resume|capacity|waitlist|embed/.test(t)) {
      return "custom-forms";
    }
    if (/notify|beehiiv|notion|webhook|confirmation|email|connection/.test(t)) return "notifications";
    if (/caddy|compose|deploy|host|cutover|redirect crm|admin\.\*|members\.\*|join\.\*/.test(t)) {
      return "vps-cutover";
    }
    if (/import|merge|ingest|jsonl|testdata/.test(t)) return "data-import";
    if (/member|application|approve|decline|inbox|note|status|csv|item/.test(t)) return "admin-inbox";
    return "admin-inbox";
  }
  // OPS
  if (/timer|systemd|compose|caddy|container|host job|path unit|vps|archive/.test(t)) return "vps-cutover";
  if (/\/f\/|custom_pages|custom form|formguard|funnel|held|resumelink|thanks_pages|apply_site_forms|capacity|waitlist/.test(t)) {
    return "custom-forms";
  }
  if (/beehiiv|notion|webhook|notify|confirmation|resume|sendqueue|conn_|newsletter|email/.test(t)) {
    return "notifications";
  }
  if (/review|member link|spotlight|staging_links|make_links|token/.test(t)) return "members-links";
  if (/import|jsonl|testdata|128|merge|backfill/.test(t)) return "data-import";
  if (/application|admin|approve|decline|csv|inbox|contact|submission|spam|rate/.test(t)) return "admin-inbox";
  if (/page|html|join|thanks|public/.test(t)) return "public-pages";
  return "admin-inbox";
}

function targetFor(id: string, title: string, body: string): { target?: string; retired?: string } {
  const t = `${title} ${body}`;
  if (/FIX-IN-REBUILD|do not port|retired with|MECHANISM/.test(t) && /retire|not port|won't port|do not port/.test(t.toLowerCase())) {
    // keep a target when it's also a capability to rebuild cleanly
  }
  for (const [page, dest] of Object.entries(OLD_TO_NEW)) {
    if (t.includes(page) || title.toLowerCase().includes(page.replace(".html", ""))) {
      if (dest.startsWith("retired:")) return { retired: dest.slice("retired:".length) };
      return { target: dest };
    }
  }
  if (id.startsWith("SITE-")) {
    const m = title.match(/→\s*`?(\/[^`\s]+)`?/);
    if (m) return { target: m[1] };
    if (/coming-soon|index\.html.*KEEP|stays at apex/i.test(t)) return { retired: "apex-coming-soon" };
    if (/redirect|caddy|archive/i.test(t)) return { target: "vps:caddy-redirects" };
    return { target: "public-site" };
  }
  if (id.startsWith("CRM-")) {
    if (/\[retired\]/.test(body) || /\bretired\b/i.test(title)) return { retired: "crm-ui" };
    if (/\/f\//.test(t)) return { target: "/f/*" };
    if (/member link|review/.test(t.toLowerCase())) return { target: "/admin#members" };
    if (/application|inbox|item/.test(t.toLowerCase())) return { target: "/admin" };
    return { target: "/admin" };
  }
  // OPS
  if (/\/f\//.test(t)) return { target: "/f/*" };
  if (/join|application/.test(t.toLowerCase())) return { target: "/join" };
  if (/review\?|member link|spotlight/.test(t.toLowerCase())) return { target: "/admin#members" };
  if (/admin/.test(t.toLowerCase())) return { target: "/admin" };
  if (/timer|systemd|compose|caddy/.test(t.toLowerCase())) return { target: "vps:cutover" };
  if (/notify|beehiiv|notion|webhook|email/.test(t.toLowerCase())) return { target: "notifications" };
  return { target: "parity" };
}

function parseFile(name: string): Item[] {
  const text = readFileSync(join(INV, name), "utf8");
  const items: Item[] = [];
  for (const line of text.split("\n")) {
    let id: string;
    let title: string;
    let body: string;
    const bold = line.match(ITEM_BOLD_TITLE);
    if (bold) {
      id = bold[1]!;
      title = bold[2]!.trim();
      body = bold[3] ?? "";
    } else {
      const plain = line.match(ITEM_PLAIN);
      if (!plain) continue;
      id = plain[1]!;
      const rest = plain[2]!.trim();
      // First sentence (or first 120 chars) as title.
      const stop = rest.search(/[.:(]/);
      title = (stop > 20 ? rest.slice(0, stop) : rest.slice(0, 120)).trim();
      body = rest;
    }
    const crmOwner = id.startsWith("CRM-") ? ownerFromCrmBracket(line) : null;
    const owner = crmOwner && crmOwner !== "retired" ? crmOwner : assignOwner(id, title, body);
    const { target, retired } = crmOwner === "retired"
      ? { retired: "crm" }
      : targetFor(id, title, body);
    const acceptance = `${title}: behaviour from ${name} is present on the new app (or deliberately retired), checkable without inventing facts.`;
    const item: Item = {
      id,
      source: `${name}:${title}`,
      acceptance,
      owner,
      status: "todo",
    };
    if (retired) item.retired = retired;
    else if (target) item.target = target;
    else item.target = "parity";
    items.push(item);
  }
  return items;
}

function main() {
  const files = readdirSync(INV).filter((f) => f.endsWith(".md")).sort();
  const prev: Record<string, Item> = {};
  if (preserve) {
    try {
      const old = JSON.parse(readFileSync(OUT, "utf8")) as { items: Item[] };
      for (const it of old.items ?? []) prev[it.id] = it;
    } catch {
      /* empty */
    }
  }

  const seen = new Set<string>();
  const items: Item[] = [];
  for (const f of files) {
    for (const it of parseFile(f)) {
      if (seen.has(it.id)) {
        console.warn(`duplicate id ${it.id} from ${f}; keeping first`);
        continue;
      }
      seen.add(it.id);
      const earlier = prev[it.id];
      if (earlier && (earlier.status === "built" || earlier.status === "verified")) {
        items.push({ ...it, status: earlier.status, evidence: earlier.evidence });
      } else {
        items.push(it);
      }
    }
  }

  items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const byOwner: Record<string, number> = {};
  for (const it of items) byOwner[it.owner] = (byOwner[it.owner] ?? 0) + 1;

  const manifest = {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    notes: "Seeded from migration/inventory/*.md. status starts as todo; builders flip to built, Haiku to verified.",
    counts: { total: items.length, byOwner },
    items,
  };
  writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${items.length} items → migration/manifest.json`);
  console.log(byOwner);
}

main();
