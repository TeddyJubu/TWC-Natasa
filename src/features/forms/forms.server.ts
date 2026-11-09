// Server-only: custom forms at /f/<slug> (migration 0005). Anyone reads an open form and sends answers (POST
// /api/forms/<slug>: size, per-visitor-per-form limit, honeypot); only admins read the answers (requireAdmin).
import type { Ctx } from "@/server/context.server";
import type { DB } from "@/server/db";
import { AccessError, requireAdmin } from "@/server/guard";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";
import { bad, isObject } from "@/server/validate";
import type { AnswerEntry } from "@/features/admin/format";
import { checkAnswers, choicesOf, type Answers, type Question } from "./schema";

export const CLOSED = "This form is closed for now. Thank you for your interest.";
export const THANKS = "Thank you — we’ve got your answers. A person reads every one.";
export const DUPLICATE = "We already have an answer from this email address for this form, so we didn’t save this one. If something has changed, email us at hello@thewomenscollective.club.";

/** What the /f/<slug> and /f/<slug>/thanks pages need. `moved`: the slug asked for is an old name of `slug`. */
export type PublicForm = { slug: string; name: string; intro: string; thanks: string; closed: string | null; questions: Question[]; moved: boolean };
export type AdminFormResponse = { id: string; created_at: string; entries: AnswerEntry[] };
export type AdminForm = { id: string; name: string; slug: string; open: boolean; total: number; responses: AdminFormResponse[] };

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

// ponytail: the newest 100 per form; paging (or CSV, CRM-135) when a form outgrows that.
const SHOWN = 100;

/** Every form with its answer count and newest answers, by name (CRM-094, CRM-135). */
export function adminFormResponses({ db, actor }: Ctx): AdminForm[] {
  requireAdmin(db, actor);
  const forms = db.prepare(`select f.id, f.name, f.slug, f.open, f.questions, (select count(*) from custom_form_responses r where r.form_id = f.id) as total
    from custom_forms f order by f.name collate nocase`).all() as (Pick<Row, "id" | "name" | "slug" | "open" | "questions"> & { total: number })[];
  const recent = db.prepare(`select id, answers, created_at from custom_form_responses where form_id = ? order by created_at desc, rowid desc limit ${SHOWN}`);
  return forms.map((f) => {
    const questions = JSON.parse(f.questions) as Question[];
    const responses = (recent.all(f.id) as { id: string; answers: string; created_at: string }[])
      .map((r) => ({ id: r.id, created_at: r.created_at, entries: responseEntries(questions, JSON.parse(r.answers) as Answers) }));
    return { id: f.id, name: f.name, slug: f.slug, open: f.open === 1, total: Number(f.total), responses };
  });
}
