// Server-only: custom forms at /f/<slug> (migration 0005). Anyone reads an open form and sends answers (POST
// /api/forms/<slug>: size, per-visitor-per-form limit, honeypot); only admins open/close forms, read answers and
// download CSV (requireAdmin).
import type { Ctx } from "@/server/context.server";
import type { DB } from "@/server/db";
import { AccessError, requireAdmin } from "@/server/guard";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";
import { bad, isObject, str } from "@/server/validate";
import { toCsv, type AnswerEntry } from "@/features/admin/format";
import { checkAnswers, choicesOf, type Answers, type Question } from "./schema";

export const CLOSED = "This form is closed for now. Thank you for your interest.";
export const THANKS = "Thank you — we’ve got your answers. A person reads every one.";
export const DUPLICATE = "We already have an answer from this email address for this form, so we didn’t save this one. If something has changed, email us at hello@thewomenscollective.club.";
/** CRM-100's closed-message cap (the column allows 2,000; the switch keeps the shorter one). */
export const CLOSED_MESSAGE_MAX = 1000;

/** What the /f/<slug> and /f/<slug>/thanks pages need. `moved`: the slug asked for is an old name of `slug`. */
export type PublicForm = { slug: string; name: string; intro: string; thanks: string; closed: string | null; questions: Question[]; moved: boolean };
export type AdminFormResponse = { id: string; created_at: string; entries: AnswerEntry[] };
export type AdminForm = {
  id: string; name: string; slug: string; open: boolean; closed_message: string;
  total: number; newest_at: string | null; responses: AdminFormResponse[];
};
export type CsvExport = { filename: string; csv: string };

type Row = { id: string; slug: string; name: string; intro: string; thanks: string; closed_message: string; questions: string; version: number; open: number; one_per_email: number };
const SLUG = /^[a-z0-9-]{1,40}$/;

/** The form behind a current or old slug; the current one wins (OPS-419, OPS-425). */
function formBySlug(db: DB, slug: unknown): { row: Row; moved: boolean } | undefined {
  if (typeof slug !== "string" || !SLUG.test(slug)) return undefined;
  const row = db.prepare("select * from custom_forms where slug = ?").get(slug) as Row | undefined;
  if (row) return { row, moved: false };
  const old = db.prepare("select f.* from custom_form_old_slugs o join custom_forms f on f.id = o.form_id where o.slug = ?").get(slug) as Row | undefined;
  return old && { row: old, moved: true };
}

/** A form for its public pages, or null for a name no form has. A closed form keeps its name and thank-you, not its questions. */
export function openForm({ db }: Ctx, input: unknown): PublicForm | null {
  const found = formBySlug(db, isObject(input) ? input.slug : undefined);
  if (!found) return null;
  const { row, moved } = found;
  const closed = row.open ? null : row.closed_message || CLOSED;
  return { slug: row.slug, name: row.name, intro: row.intro, thanks: row.thanks || THANKS, closed, questions: closed ? [] : JSON.parse(row.questions), moved };
}

const isBot = (input: Record<string, unknown>) => input.honeypot !== undefined && input.honeypot !== "" && input.honeypot !== null;

/**
 * Checks and stores one answer: `{ answers: { <question key>: … }, honeypot }`. A filled honeypot gets the same
 * success with nothing stored (OPS-195, OPS-242). Answers sent to an old name land on the form (a page opened before
 * a rename). node:sqlite is synchronous, so the one-per-email check and the insert can't interleave with another request.
 */
export function submitResponse({ db }: Ctx, slug: string, input: unknown): void {
  if (!isObject(input)) throw bad("answers");
  if (isBot(input)) return;
  const found = formBySlug(db, slug);
  if (!found) throw new HttpError("We couldn’t find that form.", 404);
  const { row } = found;
  if (!row.open) throw new HttpError(row.closed_message || CLOSED, 410);
  const checked = checkAnswers(JSON.parse(row.questions) as Question[], isObject(input.answers) ? input.answers : {});
  if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
  if (row.one_per_email && checked.email
    && db.prepare("select 1 from custom_form_responses where form_id = ? and email = ?").get(row.id, checked.email)) {
    throw new HttpError(DUPLICATE, 409);
  }
  db.prepare("insert into custom_form_responses (form_id, form_version, answers, email) values (?, ?, ?, ?)")
    .run(row.id, row.version, JSON.stringify(checked.value), checked.email);
}

// ponytail: 10 per visitor per form per 10 minutes, in memory (see rateLimit). The old service counted only stored
// answers (OPS-479); this counts every POST, which only matters to someone resending a refused form 10 times.
const limit = rateLimit(10, 10 * 60 * 1000);

/** POST /api/forms/<slug> (JSON, ≤ 64 KB, the old MAX_TEXT): slug shape, size and the limit are checked before the body is read. */
export function formRequest(c: Ctx, request: Request, slug: string): Promise<Response> {
  return respond(async () => {
    if (!SLUG.test(slug)) throw new HttpError("We couldn’t find that form.", 404);
    checkSize(request, 64 * 1024);
    if (!limit(`${clientIp(request.headers)} ${slug}`)) throw new HttpError("We’ve had several answers from your connection in the last few minutes, so we didn’t save this one. Please wait a few minutes and send it again.", 429);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw bad("answers");
    }
    submitResponse(c, slug, input);
  });
}

/** Stored answers as label/value rows in question order (choice values shown by their labels), then any keys from older versions. */
export function responseEntries(questions: Question[], answers: Answers): AnswerEntry[] {
  const known = new Set(questions.map((q) => q.key));
  const label = (q: Question, v: string) => choicesOf(q).find((c) => c.value === v)?.label ?? v;
  return [
    ...questions.filter((q) => answers[q.key] !== undefined).map((q) => {
      const v = answers[q.key]!;
      return { key: q.key, label: q.label, value: Array.isArray(v) ? v.map((x) => label(q, x)) : label(q, v) };
    }),
    ...Object.entries(answers).filter(([k]) => !known.has(k)).map(([key, value]) => ({ key, label: key, value })),
  ];
}

// ponytail: the newest 100 per form in the card; CSV (CRM-130) exports every answer.
const SHOWN = 100;

/** Every form with its answer count, newest date and newest answers, by name (CRM-094, CRM-099, CRM-135). */
export function adminFormResponses({ db, actor }: Ctx): AdminForm[] {
  requireAdmin(db, actor);
  const forms = db.prepare(`select f.id, f.name, f.slug, f.open, f.closed_message, f.questions,
      (select count(*) from custom_form_responses r where r.form_id = f.id) as total,
      (select max(r.created_at) from custom_form_responses r where r.form_id = f.id) as newest_at
    from custom_forms f order by f.name collate nocase`).all() as (Pick<Row, "id" | "name" | "slug" | "open" | "closed_message" | "questions"> & { total: number; newest_at: string | null })[];
  const recent = db.prepare(`select id, answers, created_at from custom_form_responses where form_id = ? order by created_at desc, rowid desc limit ${SHOWN}`);
  return forms.map((f) => {
    const questions = JSON.parse(f.questions) as Question[];
    const responses = (recent.all(f.id) as { id: string; answers: string; created_at: string }[])
      .map((r) => ({ id: r.id, created_at: r.created_at, entries: responseEntries(questions, JSON.parse(r.answers) as Answers) }));
    return {
      id: f.id, name: f.name, slug: f.slug, open: f.open === 1, closed_message: f.closed_message,
      total: Number(f.total), newest_at: f.newest_at, responses,
    };
  });
}

/**
 * Open or close a custom form (CRM-100). Closing keeps /f/<slug> reachable with closed_message (openForm).
 * Opening with no message keeps the last closed_message; a provided message (≤ 1,000 chars) is stored either way.
 */
export function setFormOpen({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("form");
  const id = str(input.id, "form", 8);
  if (id.length !== 8) throw bad("form");
  if (input.open !== true && input.open !== false) throw bad("open");
  const open = input.open;
  const row = db.prepare("select closed_message from custom_forms where id = ?").get(id) as { closed_message: string } | undefined;
  if (!row) throw bad("form");
  let message = row.closed_message;
  if (input.message !== undefined) {
    const next = str(input.message, "message", CLOSED_MESSAGE_MAX).trim();
    // Empty on open keeps the last message (CRM-100); empty on close clears to the public default.
    if (next || !open) message = next;
  }
  db.prepare(`update custom_forms set open = ?, closed_message = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?`)
    .run(open ? 1 : 0, message, id);
}

/** One answer cell for CSV: choice labels joined, else the string (CRM-130). */
const csvCell = (value: string | string[]) => (Array.isArray(value) ? value.join(", ") : value);

/**
 * Every answer for one form as CSV (CRM-130): BOM, CRLF, quoted cells, formula guard. Header = Received (UTC) +
 * question labels (a duplicate wording gets ` (key)`). Filename `<slug>-responses-<YYYY-MM-DD>.csv`.
 */
export function formResponsesCsv({ db, actor }: Ctx, input: unknown): CsvExport {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("form");
  const id = str(input.id, "form", 8);
  if (id.length !== 8) throw bad("form");
  const form = db.prepare("select slug, questions from custom_forms where id = ?").get(id) as { slug: string; questions: string } | undefined;
  if (!form) throw bad("form");
  const questions = JSON.parse(form.questions) as Question[];
  const seen = new Map<string, number>();
  for (const q of questions) seen.set(q.label, (seen.get(q.label) ?? 0) + 1);
  const used = new Map<string, number>();
  const headers = ["Received (UTC)", ...questions.map((q) => {
    const n = seen.get(q.label)!;
    if (n === 1) return q.label;
    const i = (used.get(q.label) ?? 0) + 1;
    used.set(q.label, i);
    return `${q.label} (${q.key})`;
  })];
  const rows = (db.prepare("select answers, created_at from custom_form_responses where form_id = ? order by created_at asc, rowid asc")
    .all(id) as { answers: string; created_at: string }[])
    .map((r) => {
      const answers = JSON.parse(r.answers) as Answers;
      return [r.created_at, ...questions.map((q) => {
        const v = answers[q.key];
        if (v === undefined) return "";
        // Choice values → labels (same as the card), so the sheet matches what an admin sees.
        const entries = responseEntries([q], { [q.key]: v });
        return csvCell(entries[0]!.value);
      })];
    });
  const day = new Date().toISOString().slice(0, 10);
  return { filename: `${form.slug}-responses-${day}.csv`, csv: toCsv(headers, rows) };
}
