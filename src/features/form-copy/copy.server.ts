// Server-only: the editable wording of the built-in forms (migration 0011). Anyone may read it (the public pages
// need it on every load); only admins write (requireAdmin). Only texts in the manifest are ever read or stored, so
// a stale row for a text the code no longer has is ignored, and no one can add wording the page never asks for.
import type { Ctx } from "@/server/context.server";
import { now, tx } from "@/server/db";
import { requireAdmin } from "@/server/guard";
import { bad, isObject } from "@/server/validate";
import { COPY_FIELDS, COPY_MAX, isCopyForm, type CopyForm } from "./manifest";

/** Default text → replacement, for the texts an admin has changed. */
export type FormCopy = Record<string, string>;

const formOf = (input: unknown): CopyForm => {
  const form = isObject(input) ? input.form : input;
  if (!isCopyForm(form)) throw bad("form");
  return form;
};

function read(db: Ctx["db"], form: CopyForm): FormCopy {
  const known = new Set(COPY_FIELDS[form].map((f) => f.text));
  const rows = db.prepare("select original, value from form_copy where form = ?").all(form) as { original: string; value: string }[];
  return Object.fromEntries(rows.filter((r) => known.has(r.original)).map((r) => [r.original, r.value]));
}

/** The replacements for one form's public page. Missing rows simply mean "use the default". */
export const publicFormCopy = ({ db }: Ctx, input: unknown): FormCopy => read(db, formOf(input));

/** Same data for the admin editor (requireAdmin keeps the editor's own read behind the guard). */
export function adminFormCopy({ db, actor }: Ctx, input: unknown): FormCopy {
  requireAdmin(db, actor);
  return read(db, formOf(input));
}

/**
 * Saves wording. `values` maps a default text to what it should say now; a blank value, or the default itself,
 * restores the default (the row is deleted). Every key must be in the manifest. Plain text, trimmed, ≤ 2,000 chars.
 */
export function saveFormCopy({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input) || !isObject(input.values)) throw bad("wording");
  const form = formOf(input);
  const known = new Set(COPY_FIELDS[form].map((f) => f.text));
  const entries = Object.entries(input.values);
  for (const [text, value] of entries) {
    if (!known.has(text)) throw bad("wording");
    if (typeof value !== "string" || value.length > COPY_MAX) throw bad("wording");
  }
  tx(db, () => {
    for (const [text, raw] of entries) {
      const value = (raw as string).trim();
      if (!value || value === text) db.prepare("delete from form_copy where form = ? and original = ?").run(form, text);
      else {
        db.prepare(`insert into form_copy (form, original, value, updated_by, updated_at) values (?, ?, ?, ?, ?)
          on conflict (form, original) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
          .run(form, text, value, me.id, now());
      }
    }
  });
}
