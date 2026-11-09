// Server-only: the one-shot import of the old site's data (BRIEF decision 10) into the app's SQLite database.
// Driven by scripts/import-legacy.ts on the VPS; unit-tested on an in-memory database with synthetic rows
// (scripts/fixtures/). Insert-only and re-runnable: a row already imported (by its legacy id or email) is left
// exactly as it is, so an admin's later edits are never overwritten.
//
// What it never does: approve anyone through sign-up (members are written to `legacy_members`, claimed by a
// verified email in the 0003 triggers), copy review tokens (members-links mints fresh hashed ones), or import
// custom-form rows (custom-forms).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DB } from "./db";

export type Row = Record<string, unknown>;
export type Sources = { applications?: Row[]; members?: Row[]; subscribers?: Row[]; submissions?: Row[] };
export type Options = { dryRun?: boolean; inboxStatus?: "new" | "archived" };
/** `imported` = new rows; `existing` = already there (left alone); `skipped` = why a row did not come in. */
export type Counts = { read: number; imported: number; existing: number; skipped: Record<string, number> };
export type Report = Record<"applications" | "members" | "subscribers" | "inbox", Counts>;

const newCounts = (): Counts => ({ read: 0, imported: 0, existing: 0, skipped: {} });
const skip = (c: Counts, why: string) => void (c.skipped[why] = (c.skipped[why] ?? 0) + 1);

/** Reads a `.jsonl` export (one object per line) or a `.json` array. Blank and unparsable lines are dropped and counted. */
export function readRows(path: string): { rows: Row[]; bad: number } {
  const text = readFileSync(path, "utf8");
  const isObject = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
  if (path.endsWith(".json")) {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array`);
    const rows = parsed.filter(isObject);
    return { rows, bad: parsed.length - rows.length };
  }
  const rows: Row[] = [];
  let bad = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (isObject(value)) rows.push(value);
      else bad++;
    } catch {
      bad++;
    }
  }
  return { rows, bad };
}

// ---------- small cleaners ----------
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const cut = (v: unknown, max: number) => text(v).slice(0, max);
const obj = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanEmail = (v: unknown): string | null => {
  const e = text(v).toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
};
/** ISO-8601 UTC (`2026-10-20T10:00:00.000Z`) from the old `at` / `…_at` strings; null when unparsable. */
const iso = (v: unknown): string | null => {
  const s = text(v);
  const d = s ? new Date(s) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};
/** Only http(s) fits profiles.website; "site.com/x" gets https://, handles and prose become ''. */
function website(v: unknown): string {
  const s = text(v);
  if (!s || /\s/.test(s)) return "";
  const url = /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s) ? `https://${s}` : "";
  return url.length <= 200 ? url : "";
}
/** Every string value capped, so one pasted essay cannot push a row past the 32 KB json checks. */
const capStrings = (v: unknown): unknown =>
  typeof v === "string" ? v.slice(0, 2000) : Array.isArray(v) ? v.map(capStrings) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, capStrings(x)])) : v;

// ---------- applications ----------
type AppStatus = "pending" | "approved" | "declined" | "merged";
/** Old lifecycle → new status. Merged duplicates are folded into the newest record and not imported. */
function applicationStatus(r: Row): AppStatus {
  const stages = [r.status, r.application_status, r.lifecycle_stage, r.review_status].map(text);
  if (stages.includes("merged")) return "merged";
  if (stages.some((s) => s === "approved" || s === "approved_member")) return "approved";
  if (stages.some((s) => s === "rejected" || s === "declined" || s === "auto_rejected" || s === "archived")) return "declined";
  return "pending";
}
/** CRM-031's origin labels. */
function origin(r: Row): string {
  if (text(r.source) === "heyform_import") return "Old HeyForm";
  if (text(r.type) === "master_member_import") return "Imported list";
  if (text(r.type) === "legacy_membership_application") return "Earlier form";
  return "Join form";
}

function importApplications(db: DB, rows: Row[]): Counts {
  const c = newCounts();
  const exists = db.prepare("select 1 from applications where legacy_id = ?");
  const insert = db.prepare(
    "insert into applications (legacy_id, email, full_name, neighborhood, answers, status, created_at, reviewed_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const r of rows) {
    c.read++;
    const answers = obj(r.answers);
    const email = cleanEmail(answers.email ?? r.email);
    if (!email) { skip(c, "bad_email"); continue; }
    const status = applicationStatus(r);
    if (status === "merged") { skip(c, "merged"); continue; }
    const at = iso(r.at) ?? iso(r.created_at);
    // CRM-028: `app-<record_id>`, or `app-<hash(at|email)>` when the old row has no record_id.
    const legacyId = `app-${text(r.record_id) || hash(`${text(r.at)}|${email}`)}`;
    if (exists.get(legacyId)) { c.existing++; continue; }
    const stored = {
      ...(capStrings(answers) as Row),
      legacy: { id: legacyId, origin: origin(r), source: text(r.source), type: text(r.type), consent_version: text(r.consent_version), status: text(r.status) },
    };
    const json = JSON.stringify(stored);
    if (json.length > 30000) { skip(c, "too_large"); continue; }
    const reviewed = status === "pending" ? null : iso(r.approved_at) ?? iso(r.declined_at) ?? iso(r.rejected_at) ?? at;
    try {
      insert.run(
        legacyId, email, cut(answers.full_name, 120) || email,
        cut(answers.neighborhood_city ?? answers.base_area, 60), json, status, at ?? new Date().toISOString(), reviewed,
      );
      c.imported++;
    } catch {
      skip(c, "rejected_by_db");
    }
  }
  return c;
}

// ---------- members ----------
function importMembers(db: DB, rows: Row[], subscribers: Row[]): Counts {
  const c = newCounts();
  const exists = db.prepare("select 1 from legacy_members where legacy_id = ?");
  const insert = db.prepare(
    `insert into legacy_members (legacy_id, email, full_name, business, role_title, website, bio, member_since, origin, data)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    c.read++;
    // A-38: old `members.jsonl` rows from the Beehiiv list are subscribers, not members.
    if (text(r.source) === "beehiiv_newsletter" || text(r.record_type) === "subscriber") { subscribers.push(r); skip(c, "subscriber"); continue; }
    if (text(r.member_status) === "archived" || text(r.lifecycle_stage) === "archived") { skip(c, "archived"); continue; }
    const email = cleanEmail(r.email);
    if (!email) { skip(c, "bad_email"); continue; }
    const id = text(r.member_id) || `m-${hash(email)}`;
    if (exists.get(id)) { c.existing++; continue; }
    const data = JSON.stringify(capStrings(r));
    if (data.length > 30000) { skip(c, "too_large"); continue; }
    try {
      insert.run(
        id, email, cut(r.full_name, 120), cut(r.business_practice, 120), cut(r.profession_role, 120), website(r.website_social),
        cut(r.short_bio ?? r.directory_bio, 400), iso(r.approved_at) ?? iso(r.created_at), cut(r.source, 60), data,
      );
      c.imported++;
    } catch {
      skip(c, "rejected_by_db");
    }
  }
  return c;
}

// ---------- newsletter ----------
const consentOf = (v: unknown): 0 | 1 | null => (text(v).toLowerCase() === "yes" ? 1 : text(v).toLowerCase() === "no" ? 0 : null);

function importSubscribers(db: DB, rows: Row[], formRows: Row[]): Counts {
  const c = newCounts();
  const find = db.prepare("select id, consent from newsletter_subscribers where email = ?");
  const insert = db.prepare(
    "insert into newsletter_subscribers (legacy_id, email, full_name, source, consent, subscribed_at) values (?, ?, ?, ?, ?, ?)",
  );
  const fill = db.prepare("update newsletter_subscribers set consent = ? where id = ?");
  const add = (email: string, legacyId: string, name: string, source: "beehiiv" | "website", consent: 0 | 1 | null, at: string | null) => {
    const have = find.get(email) as { id: string; consent: number | null } | undefined;
    if (have) {
      if (have.consent === null && consent !== null) fill.run(consent, have.id); // a form answer beats "never recorded"
      c.existing++;
      return;
    }
    try {
      insert.run(legacyId, email, name, source, consent, at ?? new Date().toISOString());
      c.imported++;
    } catch {
      skip(c, "rejected_by_db");
    }
  };
  for (const r of rows) {
    c.read++;
    const email = cleanEmail(r.email);
    if (!email) { skip(c, "bad_email"); continue; }
    const id = text(r.subscriber_id) || text(r.member_id) || hash(email);
    add(email, `newsletter-${id}`, cut(r.full_name, 120), text(r.source) === "beehiiv_newsletter" ? "beehiiv" : "website", null,
      iso(r.converted_at) ?? iso(r.migrated_at) ?? iso(r.created_at));
  }
  for (const r of formRows) {
    c.read++;
    const f = obj(r.fields);
    const email = cleanEmail(f.email);
    if (!email) { skip(c, "bad_email"); continue; }
    const at = iso(r.at);
    add(email, `newsletter-${hash(`${text(r.at)}|newsletter|${email}`)}`, cut(f.name, 120), "website", consentOf(f.consent), at);
  }
  return c;
}

// ---------- inbox (contact + partnership rows from submissions.jsonl) ----------
const COLLAB = new Set(["host", "teach", "supply", "support", "other"]);

function importInbox(db: DB, rows: Row[], status: "new" | "archived"): Counts {
  const c = newCounts();
  const dupe = db.prepare("select 1 from inbox_messages where kind = ? and email = ? and created_at = ?");
  const insert = db.prepare(
    `insert into inbox_messages (kind, name, email, topic, business, collaboration_type, message, status, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    c.read++;
    const form = text(r.form);
    if (r.deleted === true) { skip(c, "tombstone"); continue; }   // OPS-225: deleted-for-good rows keep their line
    if (form !== "contact" && form !== "partnership") { skip(c, form === "newsletter" ? "newsletter" : "other_form"); continue; }
    if (obj(r.spam).likely === true) { skip(c, "spam"); continue; }
    const f = obj(r.fields);
    const email = cleanEmail(f.email);
    const message = cut(f.message, 5000);
    const at = iso(r.at);
    if (!email || !message || !at) { skip(c, !email ? "bad_email" : !message ? "no_message" : "bad_date"); continue; }
    if (dupe.get(form, email, at)) { c.existing++; continue; }
    const name = cut(f.name, 120) || email;
    try {
      if (form === "contact") insert.run("contact", name, email, cut(f.subject ?? f.topic, 120) || "General", null, null, message, status, at);
      else {
        const type = text(f.collaboration_type);
        insert.run("partnership", name, email, null, cut(f.organization ?? f.business, 120) || null, COLLAB.has(type) ? type : "other", message, status, at);
      }
      c.imported++;
    } catch {
      skip(c, "rejected_by_db");
    }
  }
  return c;
}

/**
 * Imports whatever sources are given in one transaction (rolled back for `dryRun`) and reports what happened.
 * Inbox rows come in `archived` by default: they were already emailed, and 100+ old messages should not look new.
 */
export function importLegacy(db: DB, src: Sources, options: Options = {}): Report {
  db.exec("begin immediate");
  try {
    const subscriberRows = [...(src.subscribers ?? [])];
    const members = importMembers(db, src.members ?? [], subscriberRows);
    const submissions = src.submissions ?? [];
    const report: Report = {
      applications: importApplications(db, src.applications ?? []),
      members,
      subscribers: importSubscribers(db, subscriberRows, submissions.filter((r) => text(r.form) === "newsletter" && r.deleted !== true)),
      inbox: importInbox(db, submissions, options.inboxStatus ?? "archived"),
    };
    db.exec(options.dryRun ? "rollback" : "commit");
    return report;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}
