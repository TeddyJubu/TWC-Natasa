# Form builder — design

Date: 2026-11-10. Branch: `feat/form-builder`.

## Goal

`/admin/forms` becomes a form building and management app inside the admin, in the spirit of Tally and Notion
forms: an admin creates, edits, duplicates and deletes her own `/f/<slug>` forms by editing the form as it looks,
and reads the answers there. Public `/f/<slug>` links, stored answers and CSV keep working.

## Decisions (user, 2026-11-10)

1. **Delete:** only a form with no answers can be deleted. A form with answers can only be closed. No Trash.
2. **Publishing:** edits save automatically as a draft; visitors see the last published version until Publish. A new
   form starts as an unpublished draft (its link is a 404 until first Publish).
3. **Extras in the first version:** conditional logic, multi-page forms, limits and alerts, file uploads.

## Assumptions

- The five built-in forms (join, review, contact, partnership, newsletter) keep their wording + open/close pages. The
  builder covers custom forms only.
- No new dependencies. Reorder is native drag-and-drop plus Move up / Move down buttons (keyboard path).
- No per-answer delete (answers are kept, decision 1). Preview never stores, so testing a form leaves it deletable.
- Not built: templates, embed, URL prefill, redirect after send, answer summary charts, payment, signatures.

## Data (migration `0012_form_builder.sql`)

New columns on `custom_forms`:

| Column | Meaning |
| --- | --- |
| `draft text null` | JSON `{ name, intro, thanks, questions }`, at most 200,000 characters. Null = no unpublished changes. |
| `published_at text null` | Null = never published (public 404). Existing rows get `created_at`. |
| `closes_at text null` | UTC ISO time. At or after it the form reads as closed. |
| `max_responses integer null` | At least 1. When the stored count reaches it the form reads as closed. |
| `notify integer not null default 0` | 1 = email the admins when an answer is stored. |

`questions` on an unpublished form is `[]`. The importer and seeds (`saveForm` in `store.ts`) set `published_at` on
insert, so what they write is live as before.

## Question model (`schema.ts`)

New types, added to the existing eleven:

| Type | Stored answer | Notes |
| --- | --- | --- |
| `heading` | none | Label is the heading, help is body text. |
| `page` | none | Page break. Label is an optional page title. Not allowed first or last, nor twice in a row. |
| `rating` | `"1"`…`"max"` | `max` from 3 to 10, default 5. |
| `consent` | `"yes"` | One checkbox; the label is the statement. |
| `time` | `HH:MM` | Native `type="time"`. |
| `file` | bucket-relative file name | See File uploads. At most 3 per form. |

Every question keeps a `key`. The builder generates it once (`q_` + 6 random characters) and never changes it, because
answers are stored by key. Choice values are generated from the label when the choice is added and then kept.

**Conditional logic:** `showIf?: { key: string; value: string; not?: true }` on any type except `page`. `key` must be
an earlier dropdown, radio, yes/no, checkboxes, consent or rating question, and `value` one of its values. A question
is shown when its controlling question is shown and its answer equals `value` (checkboxes: includes it); `not` flips
the comparison. A hidden question's answer is dropped and its `required` is not enforced. One function,
`visibleKeys(questions, answers)`, is shared by the page and `checkAnswers`, so the server decides.

**Pages:** `page` blocks split the form into steps on the client (Back / Next, "Step 2 of 3"). Next validates the
current step's shown questions. A step with no shown questions is skipped. The server validates the whole form.

## Server (`forms.server.ts`, `requireAdmin` on every admin function)

| Function | Does |
| --- | --- |
| `adminForms` | The list: id, name, slug, open, state, answer count, newest date, has-draft. No answers. |
| `adminForm` | One form: live definition, draft, settings, newest 500 answers. |
| `createForm` | New row: fresh id, name "Untitled form", slug `form-<id>`, `questions` `[]`, a starter draft, unpublished. |
| `saveFormDraft` | Stores the draft after a shape check (sizes and counts only), so half-written forms autosave. |
| `publishForm` | Strict `checkQuestions` on the draft, writes it live, version + 1, clears the draft, sets `published_at`. |
| `discardFormDraft` | Clears the draft of a published form. |
| `saveFormSettings` | Slug (old name kept as a 301), open, closed message, one per email, close date, max answers, alerts. Live at once. |
| `duplicateForm` | New unpublished form whose draft is the source's draft or live content; settings copied, new slug. |
| `deleteForm` | Refuses when the form has any answer; otherwise deletes the row. |
| `formResponsesCsv` | Unchanged, plus file answers as full URLs. |

`saveAdminForm` and `setFormOpen` are replaced by the functions above. `closedReason(row, count, now)` returns the
closed words when the form is switched closed, past `closes_at`, or at `max_responses`; `openForm` and
`submitResponse` both use it. After a stored answer, `notify` forms call `notifyAdmins` (subject and a link to the
answers; no answer text in the email), which never fails the request.

## File uploads

- A form with a `file` question posts `multipart/form-data` to the same `POST /api/forms/<slug>`: `answers` (JSON),
  `honeypot`, and one part per file question named `file:<key>`. Forms without one keep posting JSON.
- Before the body is read: slug shape, then the form lookup sets the size cap (64 KB, or 16 MB with file questions),
  then the per-visitor limit.
- Each file: at most 5 MB, type from its first bytes — PDF, PNG, JPEG or WebP. Images lose their metadata
  (`stripMetadata`).
- Stored at `uploads/form-files/<form id>/<response id>-<key>.<ext>`, written before the insert and removed if the
  insert fails.
- Served only at `/media/form-files/…` to admins, `Cache-Control: private, no-store`, `nosniff`; a PDF is sent as an
  attachment. Everyone else gets the same 404.

## Admin UI

**`/admin/forms` (list):** a "New form" button, a search box, "Your forms" rows (name, state chip — Draft, Live,
Closed, Unpublished changes — link, answer count) each with Open, Duplicate, Copy link and Delete, then "Built-in
forms". Delete is disabled with its reason when the form has answers.

**`/admin/forms/<id>` (builder)** for a custom form, with three tabs (`?tab=`):

- **Build:** the form as visitors see it. Title, intro and each question's label and help are edited in place. A
  question shows its type, Required, Logic, Move up / down, Duplicate and Remove when focused or hovered. "Add" opens a
  type picker. Choices are a list with add, remove and reorder. Thank-you words are edited at the foot. Changes
  autosave as a draft with a "Saved" indicator; Publish and Discard changes sit in the header; Preview shows the draft
  through the public component and stores nothing.
- **Settings:** link name, open/closed and closed words, one answer per email, close date, maximum answers, email
  alerts, and the share link with Copy.
- **Answers:** a table (one column per question, newest first), a search box, a row's full answers on click, file
  answers as download links, and Download CSV.

Code lives in `src/features/forms/builder/` (canvas, block editor, settings, answers) and replaces `FormEditor.tsx`,
`form-draft.ts` and the custom-form parts of `admin/panels.tsx`. It uses the app shell tokens and `app-ui` cards.

## Testing

- `forms.test.ts`: migration 0012, each new server function and its `requireAdmin`, delete refused with answers, draft
  invisible until Publish, closed by date and by count, alerts never failing a request.
- `schema.test.ts`: new types, `showIf` checks, `visibleKeys`, hidden answers dropped.
- Upload tests: size cap before read, type by bytes, admin-only serving, cleanup on a failed insert.
- Component tests: builder add/reorder/remove, autosave payload, public multi-page stepping and logic.
- `policy.test.ts` and the `API_ROUTES` test keep passing.

## Build order

1. Migration, question model, logic, server functions, tests.
2. Public page: new types, logic, pages.
3. Admin list and builder.
4. File uploads.
5. `AGENTS.md` and `AUDIT-TASKS.md`.
