// Server-only: the one-shot import of the CRM's custom forms and their old answers (forms-import, OPS-518), so the
// apex's /f/* links can 301 to the new app. Driven by scripts/import-forms.ts on the VPS; tested with the made-up
// CRM dump in scripts/fixtures/. Relative imports only, so it runs under plain Node.
//
// Definitions come from the CRM database (custom_forms, custom_form_slugs, form_versions under 'custom:<id>'): the
// published JSON lists fields without their choices, which live only in its pre-rendered HTML and are never read
// from there. Every form goes through saveForm (checkQuestions is the gate). Answers come from submissions.jsonl
// (`form: "custom"`) into custom_form_responses, keyed by a hash of the whole line, so re-running adds only new lines.
// Reports are counts, ids, slugs and types; never an answer.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DB } from "../../server/db.ts";
import { MAX_VALUE, QUESTION_TYPES, type Answers } from "./schema.ts";
import { saveForm, type FormDefinition } from "./store.ts";

type Row = Record<string, unknown>;
/** The CRM's tables, as `select *` gives them (or the same shape as JSON: scripts/fixtures/crm-forms.json). */
export type CrmDump = { custom_forms: Row[]; custom_form_slugs: Row[]; form_versions: Row[] };
/** A field of a CRM definition (crm/shared/formdef.ts FormField), read as untrusted. */
type Field = Row & { key?: unknown; type?: unknown; label?: unknown };
type Tally = Record<string, number>;

export type FormNote = { id: string; slug: string; status: "imported" | "updated" | "skipped"; reason?: string; converted: Tally; dropped: Tally };
export type ResponseCounts = { read: number; imported: number; existing: number; skipped: Tally };
export type FormsReport = { forms: FormNote[]; responses: ResponseCounts };
export type ImportInput = { crm: CrmDump; published?: Row[]; submissions?: Row[]; held?: unknown };

const ID = /^[a-z0-9]{8}$/;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const bump = (t: Tally, k: string) => void (t[k] = (t[k] ?? 0) + 1);

/** Reads the three CRM tables (read-only). Run against a copy of crm.db, or the live file with the CRM stopped. */
export function readCrmDb(path: string): CrmDump {
  const crm = new DatabaseSync(path, { readOnly: true });
  try {
    const all = (sql: string) => crm.prepare(sql).all() as Row[];
    return {
      custom_forms: all("select * from custom_forms"),
      custom_form_slugs: all("select * from custom_form_slugs"),
      form_versions: all("select kind, version, definition from form_versions where kind like 'custom:%'"),
    };
  } finally {
    crm.close();
  }
}

/** The published `<id>.json` files (fallback only, for a form whose custom_forms row is missing). */
export function readPublished(dir: string): Row[] {
  return readdirSync(dir).filter((f) => /^[a-z0-9]{8}\.json$/.test(f) && statSync(join(dir, f)).size <= 1_000_000).flatMap((f) => {
    try {
      const row: unknown = JSON.parse(readFileSync(join(dir, f), "utf8"));
      return row && typeof row === "object" && (row as Row).kind === "custom" && (row as Row).id === f.slice(0, 8) ? [row as Row] : [];
    } catch {
      return [];
    }
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };
/** The published `<p>` paragraphs as plain text (paragraphs on blank lines), for the fallback only. */
export function htmlToText(html: unknown): string {
  return str(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(Number(e[1] === "x" || e[1] === "X" ? `0${e.slice(1)}` : e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m))
    .split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).join("\n\n");
}

/** `[words](link)` → `words`: the new pages show plain text, no links. */
const unlink = (s: string) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const SUPPORTED = new Set<string>(QUESTION_TYPES);
/** No question, nothing lost going forward: a text block, a value set by the link, a sum worked out from earlier answers. */
const DROPPED = new Set(["statement", "hidden", "total"]);

/**
 * One CRM field as one of our questions, or why not. Conversions: scale → radio with its numbers (end words on the
 * ends), rating → radio 1–5, consent → one required tick box, time → short answer. Show/hide is not ported, so a
 * required question that had a show-if rule becomes optional (else people it never applied to couldn't send).
 */
function toQuestion(f: Field, notes: { converted: Tally; dropped: Tally }): Row | null | { unsupported: string } {
  const type = str(f.type);
  if (DROPPED.has(type)) return bump(notes.dropped, type), null;
  const conditional = f.showIf !== undefined && f.showIf !== null;
  if (f.required === true && conditional) bump(notes.converted, "required-with-show-if→optional");
  const help = typeof f.help === "string" && f.help.trim() ? { help: unlink(f.help) } : {};
  const base = { key: f.key, label: typeof f.label === "string" ? unlink(f.label) : f.label, required: f.required === true && !conditional, ...help };
  const as = (to: string) => bump(notes.converted, `${type}→${to}`);
  switch (type) {
    case "scale": {
      const lo = f.min === 0 ? 0 : 1;
      const hi = typeof f.max === "number" && Number.isInteger(f.max) && f.max >= 2 && f.max <= 10 ? f.max : 5;
      const end = (n: number) => str(n === lo ? f.minLabel : n === hi ? f.maxLabel : "");
      as("radio");
      return { ...base, type: "radio", choices: range(lo, hi).map((n) => ({ value: String(n), label: end(n) ? `${n} — ${end(n)}` : String(n) })) };
    }
    case "rating":
      as("radio");
      return { ...base, type: "radio", choices: range(1, 5).map((n) => ({ value: String(n), label: `${n} of 5` })) };
    case "consent":
      as("checkboxes");
      return { ...base, type: "checkboxes", choices: [{ value: "yes", label: "I agree" }] };
    case "time":
      as("short");
      return { ...base, type: "short" };
  }
  if (!SUPPORTED.has(type)) return { unsupported: type || "unknown" };
  return { ...base, type, ...(Array.isArray(f.choices) ? { choices: f.choices.map((c: Row) => ({ value: c?.value, label: c?.label })) } : {}) };
}

/** One stored answer for one field, the way the new forms store it (checkboxes as a list; the old "a, b"). */
function answerOf(f: Field, raw: unknown): string | string[] | undefined {
  const type = str(f.type);
  if (type === "statement" || type === "file") return undefined;
  if (Array.isArray(raw)) raw = raw.map(str).join(", ");
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  if (type === "checkboxes") return [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))];
  if (type === "consent") return /^(on|yes|true|1)$/i.test(v) ? ["yes"] : undefined;
  return v.slice(0, MAX_VALUE);
}

/** The CRM's item id for a custom answer (crm/server/customingest.ts), which tombstones and held.json name. */
const crmItemId = (row: Row) => {
  const fields = (row.fields ?? {}) as Row;
  return `custom-${createHash("sha256").update([str(row.at), str(row.form_id), str(fields.email).toLowerCase()].join("|")).digest("hex").slice(0, 12)}`;
};
/** A stable response id from the whole line, so two different answers never share one (FIX-IN-REBUILD CRM-173). */
function responseId(row: Row): string {
  const h = createHash("sha256").update(JSON.stringify(row)).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[parseInt(h[16]!, 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type Plan = { def: FormDefinition; versions: Map<number, Field[]>; live: number };

/** What each form would become, or why it can't come in. */
function plan(input: ImportInput): { plans: Map<string, Plan>; notes: FormNote[] } {
  const { crm, published = [] } = input;
  const versions = new Map<string, Map<number, Field[]>>();
  for (const v of crm.form_versions) {
    const id = str(v.kind).replace(/^custom:/, "");
    try {
      const fields = (JSON.parse(str(v.definition)) as { fields?: unknown }).fields;
      if (ID.test(id) && Number.isInteger(Number(v.version)) && Array.isArray(fields)) {
        if (!versions.has(id)) versions.set(id, new Map());
        versions.get(id)!.set(Number(v.version), fields as Field[]);
      }
    } catch { /* an unreadable version counts as missing */ }
  }
  const slugs = new Map<string, string[]>();
  for (const s of crm.custom_form_slugs) slugs.set(str(s.form_id), [...(slugs.get(str(s.form_id)) ?? []), str(s.slug)]);
  const rows = new Map(crm.custom_forms.map((r) => [str(r.id), r]));
  const pub = new Map(published.map((p) => [str(p.id), p]));

  const plans = new Map<string, Plan>();
  const notes: FormNote[] = [];
  for (const id of new Set([...rows.keys(), ...pub.keys()])) {
    const row = rows.get(id);
    const p = pub.get(id);
    const slug = str(row?.slug ?? p?.slug);
    const note: FormNote = { id, slug, status: "skipped", converted: {}, dropped: {} };
    notes.push(note);
    let vs = versions.get(id) ?? new Map<number, Field[]>();
    let fromPublished = false;
    if (!vs.size && !row && p && Array.isArray(p.fields)) {
      vs = new Map([[Number(p.version) || 1, p.fields as Field[]]]);
      fromPublished = true;
    }
    if (!ID.test(id)) { note.reason = "id is not 8 characters a–z, 0–9"; continue; }
    if (!vs.size) { note.reason = "never published (no form_versions row)"; continue; }
    const live = Math.max(...vs.keys());
    const questions: Row[] = [];
    const unsupported = new Set<string>();
    for (const f of vs.get(live)!) {
      const q = toQuestion(f, note);
      if (q && "unsupported" in q) unsupported.add(String(q.unsupported));
      else if (q) questions.push(q);
    }
    if (unsupported.size) { note.reason = `unsupported question types: ${[...unsupported].sort().join(", ")}`; continue; }
    if (fromPublished && questions.some((q) => ["dropdown", "radio", "checkboxes"].includes(str(q.type)) && !Array.isArray(q.choices))) {
      note.reason = "no CRM definition, and the published file keeps its choices only in HTML";
      continue;
    }
    const def: FormDefinition = row
      ? { id, slug, name: str(row.name), intro: str(row.intro), thanks: str(row.thanks), closed_message: str(row.closed_message),
        open: Number(row.open) !== 0, one_per_email: Number(row.one_per_email) === 1, version: live, questions,
        old_slugs: (slugs.get(id) ?? []).filter((s) => s !== slug) }
      : { id, slug, name: str(p!.name), intro: htmlToText(p!.intro_html), thanks: htmlToText(p!.thanks_html), closed_message: str(p!.closed_message),
        open: p!.open !== false, one_per_email: p!.one_per_email === true, version: live, questions,
        old_slugs: Array.isArray(p!.old_slugs) ? p!.old_slugs.map(str).filter((s) => s && s !== slug) : [] };
    plans.set(id, { def, versions: vs, live });
  }
  return { plans, notes };
}

/** held.json → the item ids an admin removed from results (CRM-131); they stay out, as they were. */
function heldIds(held: unknown): Set<string> {
  const out = new Set<string>();
  const forms = (held as { held?: unknown } | null)?.held;
  if (forms && typeof forms === "object") for (const items of Object.values(forms)) if (items && typeof items === "object") for (const k of Object.keys(items)) out.add(k);
  return out;
}

function importResponses(db: DB, input: ImportInput, plans: Map<string, Plan>, imported: Set<string>): ResponseCounts {
  const c: ResponseCounts = { read: 0, imported: 0, existing: 0, skipped: {} };
  const rows = (input.submissions ?? []).filter((r) => r.form === "custom" || (r.deleted === true && str(r.item).startsWith("custom-")));
  const tombstones = new Set(rows.filter((r) => r.deleted === true).map((r) => str(r.item)));
  const held = heldIds(input.held);
  const insert = db.prepare("insert into custom_form_responses (id, form_id, form_version, answers, email, created_at) values (?, ?, ?, ?, ?, ?) on conflict (id) do nothing");
  for (const row of rows) {
    c.read++;
    if (row.deleted === true) { bump(c.skipped, "deletion marker"); continue; }
    const p = plans.get(str(row.form_id));
    if (!p || !imported.has(str(row.form_id))) { bump(c.skipped, "form not imported"); continue; }
    const item = crmItemId(row);
    if (tombstones.has(item)) { bump(c.skipped, "deleted for good"); continue; }
    if (held.has(item)) { bump(c.skipped, "removed from results (held)"); continue; }
    const at = Date.parse(str(row.at));
    if (Number.isNaN(at)) { bump(c.skipped, "no valid date"); continue; }
    const version = Number(row.form_version);
    const fields = p.versions.get(version) ?? p.versions.get(p.live)!;
    const raw = (row.fields && typeof row.fields === "object" ? row.fields : {}) as Row;
    const answers: Answers = {};
    for (const f of fields) {
      const v = typeof f.key === "string" ? answerOf(f, raw[f.key]) : undefined;
      if (v !== undefined) answers[f.key as string] = v;
    }
    if (!Object.keys(answers).length) { bump(c.skipped, "no answers"); continue; }
    const emailKey = fields.find((f) => f.type === "email")?.key;
    const email = typeof emailKey === "string" && typeof answers[emailKey] === "string" ? (answers[emailKey] as string).toLowerCase() : null;
    try {
      const { changes } = insert.run(responseId(row), p.def.id, Number.isInteger(version) && version >= 1 ? version : p.live,
        JSON.stringify(answers), email && email.length <= 254 ? email : null, new Date(at).toISOString());
      if (changes) c.imported++;
      else c.existing++;
    } catch {
      bump(c.skipped, "rejected by the table");
    }
  }
  return c;
}

/**
 * Imports the forms (through saveForm, each in its own savepoint so one bad form never half-lands) and then their
 * answers, in one transaction (rolled back for `dryRun`). Re-running updates forms by id and adds only new answers.
 */
export function importForms(db: DB, input: ImportInput, options: { dryRun?: boolean } = {}): FormsReport {
  db.exec("begin immediate");
  try {
    const { plans, notes } = plan(input);
    const imported = new Set<string>();
    for (const note of notes) {
      const p = plans.get(note.id);
      if (!p) continue;
      const existed = !!db.prepare("select 1 from custom_forms where id = ?").get(note.id);
      db.exec("savepoint form");
      try {
        saveForm(db, p.def);
        db.exec("release form");
        note.status = existed ? "updated" : "imported";
        imported.add(note.id);
      } catch (error) {
        db.exec("rollback to form; release form");
        // checkQuestions' own words name only the question number; SQLite's name only the column.
        note.reason = error instanceof Error && /^Question \d+|^A form needs/.test(error.message) ? error.message : "refused by the table (slug or name rule, or a name another form owns)";
      }
    }
    const responses = importResponses(db, input, plans, imported);
    db.exec(options.dryRun ? "rollback" : "commit");
    return { forms: notes, responses };
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}
