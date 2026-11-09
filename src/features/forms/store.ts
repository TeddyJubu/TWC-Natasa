// Server-only: writes a custom form's definition (migration 0005). Relative imports only, so scripts/seed-forms.ts runs
// it under plain Node; the CRM importer and, later, the form builder write through here too.
import { tx, type DB } from "../../server/db.ts";
import { checkQuestions } from "./schema.ts";

export type FormDefinition = {
  /** The CRM's 8-character id ([a-z0-9]). */
  id: string;
  slug: string;
  name: string;
  intro?: string;
  thanks?: string;
  closed_message?: string;
  questions: unknown;
  version?: number;
  open?: boolean;
  one_per_email?: boolean;
  /** Names the form used to have; each redirects to `slug`. */
  old_slugs?: string[];
};

/** Creates or replaces a form by id (questions checked here; slug, name and lengths by the table's CHECKs). */
export function saveForm(db: DB, def: FormDefinition): void {
  const questions = checkQuestions(def.questions);
  tx(db, () => {
    db.prepare(`insert into custom_forms (id, slug, name, intro, thanks, closed_message, questions, version, open, one_per_email)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (id) do update set slug = excluded.slug, name = excluded.name, intro = excluded.intro, thanks = excluded.thanks,
        closed_message = excluded.closed_message, questions = excluded.questions, version = excluded.version, open = excluded.open,
        one_per_email = excluded.one_per_email, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
      .run(def.id, def.slug, def.name.trim(), def.intro ?? "", def.thanks ?? "", def.closed_message ?? "", JSON.stringify(questions),
        def.version ?? 1, def.open === false ? 0 : 1, def.one_per_email ? 1 : 0);
    db.prepare("delete from custom_form_old_slugs where form_id = ?").run(def.id);
    const old = db.prepare("insert into custom_form_old_slugs (slug, form_id) values (?, ?)");
    for (const slug of def.old_slugs ?? []) old.run(slug, def.id);
  });
}
