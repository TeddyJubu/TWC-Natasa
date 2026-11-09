// Minimal custom-form editor for /admin › Form responses: meta + the question types /f/<slug> already renders.
// Writes go through saveAdminForm → saveForm / checkQuestions — no new widget types.
import * as React from "react";
import { fieldClass, primaryButton, secondaryButton } from "@/app/layout/app-classes";
import { QUESTION_TYPES, type QuestionType } from "./schema";
import { blankQuestion, NEEDS_CHOICES, type FormEditorValues } from "./form-draft";

const TYPE_LABEL: Record<QuestionType, string> = {
  short: "Short text", email: "Email", phone: "Phone", url: "URL", number: "Number", date: "Date",
  paragraph: "Paragraph", dropdown: "Dropdown", radio: "Radio", checkboxes: "Checkboxes", yesno: "Yes / No",
};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="twc-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="twc-hint">{hint}</p>}
    </div>
  );
}

export function FormEditor({
  idPrefix, title, initial, submitLabel, busy, error, onSubmit, onCancel,
}: {
  idPrefix: string;
  title: string;
  initial: FormEditorValues;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (values: FormEditorValues) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = React.useState(initial);
  const id = (field: string) => `${idPrefix}-${field}`;

  function setQuestion(index: number, patch: Partial<FormEditorValues["questions"][number]>) {
    setValues((v) => ({
      ...v,
      questions: v.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    onSubmit(values);
  }

  return (
    <form onSubmit={submit} aria-label={title} className="flex flex-col gap-5">
      <h3 className="font-display text-xl/[1.3] text-ink">{title}</h3>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id={id("name")} label="Name">
          <input id={id("name")} required maxLength={80} value={values.name} disabled={busy}
            onChange={(e) => { const name = e.currentTarget.value; setValues((v) => ({ ...v, name })); }} className={fieldClass} />
        </Field>
        <Field id={id("slug")} label="Slug" hint="Lowercase letters, numbers and single hyphens. Shown as /f/…">
          <input id={id("slug")} required maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={values.slug} disabled={busy}
            aria-describedby={`${id("slug")}-hint`}
            onChange={(e) => { const slug = e.currentTarget.value; setValues((v) => ({ ...v, slug })); }} className={fieldClass} />
        </Field>
      </div>
      <Field id={id("intro")} label="Intro" hint="Plain text. Blank lines become paragraphs.">
        <textarea id={id("intro")} rows={3} maxLength={1200} value={values.intro} disabled={busy}
          aria-describedby={`${id("intro")}-hint`}
          onChange={(e) => { const intro = e.currentTarget.value; setValues((v) => ({ ...v, intro })); }} className={fieldClass} />
      </Field>
      <Field id={id("thanks")} label="Thank-you" hint="Shown after someone sends answers.">
        <textarea id={id("thanks")} rows={2} maxLength={600} value={values.thanks} disabled={busy}
          aria-describedby={`${id("thanks")}-hint`}
          onChange={(e) => { const thanks = e.currentTarget.value; setValues((v) => ({ ...v, thanks })); }} className={fieldClass} />
      </Field>
      <Field id={id("closed")} label="Closed message" hint="Shown on /f/… when the form is closed (up to 1,000 characters).">
        <input id={id("closed")} maxLength={1000} value={values.closed_message} disabled={busy}
          aria-describedby={`${id("closed")}-hint`}
          onChange={(e) => { const closed_message = e.currentTarget.value; setValues((v) => ({ ...v, closed_message })); }} className={fieldClass} />
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={values.open} disabled={busy}
            onChange={(e) => { const open = e.currentTarget.checked; setValues((v) => ({ ...v, open })); }} />
          Open for answers
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={values.one_per_email} disabled={busy}
            onChange={(e) => { const one_per_email = e.currentTarget.checked; setValues((v) => ({ ...v, one_per_email })); }} />
          One answer per email
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-ink">Questions</h4>
          <button type="button" className={secondaryButton} disabled={busy}
            onClick={() => setValues((v) => ({ ...v, questions: [...v.questions, blankQuestion()] }))}>
            Add question
          </button>
        </div>
        {values.questions.map((q, index) => (
          <fieldset key={index} className="flex flex-col gap-3 rounded-md bg-app p-3.5 shadow-[inset_0_0_0_1px_var(--color-app-line)]">
            <legend className="px-1 text-xs font-medium text-app-muted">Question {index + 1}</legend>
            <div className="grid gap-3 md:grid-cols-3">
              <Field id={id(`q${index}-key`)} label="Key" hint="a–z, 0–9, _">
                <input id={id(`q${index}-key`)} required maxLength={40} value={q.key} disabled={busy}
                  aria-describedby={`${id(`q${index}-key`)}-hint`}
                  onChange={(e) => setQuestion(index, { key: e.currentTarget.value })} className={fieldClass} />
              </Field>
              <Field id={id(`q${index}-type`)} label="Type">
                <select id={id(`q${index}-type`)} value={q.type} disabled={busy}
                  onChange={(e) => setQuestion(index, { type: e.currentTarget.value as QuestionType })} className={fieldClass}>
                  {QUESTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field id={id(`q${index}-label`)} label="Label">
                <input id={id(`q${index}-label`)} required maxLength={300} value={q.label} disabled={busy}
                  onChange={(e) => setQuestion(index, { label: e.currentTarget.value })} className={fieldClass} />
              </Field>
            </div>
            <Field id={id(`q${index}-help`)} label="Help" hint="Optional hint under the field.">
              <input id={id(`q${index}-help`)} maxLength={500} value={q.help} disabled={busy}
                aria-describedby={`${id(`q${index}-help`)}-hint`}
                onChange={(e) => setQuestion(index, { help: e.currentTarget.value })} className={fieldClass} />
            </Field>
            {NEEDS_CHOICES.has(q.type) && (
              <Field id={id(`q${index}-choices`)} label="Choices" hint="One per line as value|Label (or a Label alone).">
                <textarea id={id(`q${index}-choices`)} rows={3} value={q.choicesText} disabled={busy} required
                  aria-describedby={`${id(`q${index}-choices`)}-hint`}
                  onChange={(e) => setQuestion(index, { choicesText: e.currentTarget.value })} className={fieldClass} />
              </Field>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={q.required} disabled={busy}
                  onChange={(e) => { const required = e.currentTarget.checked; setQuestion(index, { required }); }} />
                Required
              </label>
              <button type="button" className={secondaryButton} disabled={busy || values.questions.length <= 1}
                aria-label={`Remove question ${index + 1}`}
                onClick={() => setValues((v) => ({ ...v, questions: v.questions.filter((_, i) => i !== index) }))}>
                Remove
              </button>
            </div>
          </fieldset>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2.5">
        {onCancel && (
          <button type="button" className={secondaryButton} disabled={busy} onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className={primaryButton} disabled={busy}>{submitLabel}</button>
      </div>
    </form>
  );
}
