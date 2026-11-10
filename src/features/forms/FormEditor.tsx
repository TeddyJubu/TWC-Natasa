// The question editor on a custom form's Questions tab: intro, questions, thank-you. Keys and choice values are made
// in form-draft.ts and never shown; open/closed, the closed message, name and web address live on the Settings tab,
// so saving questions can never undo them. Writes go through saveAdminForm → saveForm / checkQuestions.
import * as React from "react";
import { cn } from "@/index";
import { fieldClass, linkClass, primaryButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import type { QuestionType } from "./schema";
import { blankQuestion, NEEDS_CHOICES, sameQuestions, type DraftQuestion, type QuestionsDraft } from "./form-draft";

/** Question types in the words a visitor would use, grouped as on the page. */
const TYPE_GROUPS: [group: string, types: [QuestionType, string][]][] = [
  ["Text", [["short", "Short answer"], ["paragraph", "Long answer"], ["email", "Email address"], ["phone", "Phone number"], ["url", "Website link"], ["number", "Number"], ["date", "Date"]]],
  ["Choice", [["radio", "Pick one"], ["dropdown", "Pick one from a list"], ["checkboxes", "Pick any"], ["yesno", "Yes or no"]]],
];

const iconButton = cn("grid size-10 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-app-sunken disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent", ring);

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="twc-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="twc-hint">{hint}</p>}
    </div>
  );
}

/** A compact on/off switch for inside a question (the card-row `Toggle` is for settings rows). */
function Switch({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input type="checkbox" role="switch" className="peer sr-only" {...input} />
      <span aria-hidden className="relative h-5.5 w-9.5 shrink-0 rounded-full bg-ink/30 transition-colors duration-150 peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-app-accent after:absolute after:top-0.75 after:left-0.75 after:size-4 after:rounded-full after:bg-app after:transition-transform after:duration-300 after:ease-snap peer-checked:after:translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none" />
      {label}
    </label>
  );
}

export function QuestionsEditor({ idPrefix, initial, busy, error, saved, onSave }: {
  idPrefix: string; initial: QuestionsDraft; busy?: boolean; error?: string | null; saved?: boolean; onSave: (draft: QuestionsDraft) => void;
}) {
  const [values, setValues] = React.useState(initial);
  const [focusField, setFocusField] = React.useState<string | null>(null);
  // Questions whose (empty) help box was opened with "Add help text".
  const [openHelp, setOpenHelp] = React.useState<ReadonlySet<string>>(new Set());
  const dirty = !sameQuestions(values, initial);
  const id = (field: string) => `${idPrefix}-${field}`;
  const qs = values.questions;

  // Leaving the page with unsaved questions asks first (the browser's own prompt).
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // A newly added question, or a just-opened help box, gets focus.
  React.useEffect(() => {
    if (!focusField) return;
    document.getElementById(focusField)?.focus();
    setFocusField(null);
  }, [focusField]);

  const setQuestions = (fn: (q: DraftQuestion[]) => DraftQuestion[]) => setValues((v) => ({ ...v, questions: fn(v.questions) }));
  const patch = (uid: string, p: Partial<DraftQuestion>) => setQuestions((list) => list.map((q) => (q.uid === uid ? { ...q, ...p } : q)));
  const move = (index: number, by: -1 | 1) => setQuestions((list) => {
    const next = [...list];
    [next[index], next[index + by]] = [next[index + by]!, next[index]!];
    return next;
  });
  const add = () => {
    const q = blankQuestion(qs.map((x) => x.key));
    setQuestions((list) => [...list, q]);
    setFocusField(id(`${q.uid}-label`));
  };
  const remove = (q: DraftQuestion, n: number) => {
    if (q.label.trim() && !window.confirm(`Remove question ${n}, “${q.label.trim()}”? Answers already sent keep it in the CSV.`)) return;
    setQuestions((list) => list.filter((x) => x.uid !== q.uid));
  };
  const setType = (q: DraftQuestion, type: QuestionType) =>
    patch(q.uid, { type, choices: NEEDS_CHOICES.has(type) && q.choices.length === 0 ? [{ value: "", label: "" }, { value: "", label: "" }] : q.choices });
  const setChoice = (q: DraftQuestion, i: number, label: string) => patch(q.uid, { choices: q.choices.map((c, j) => (j === i ? { ...c, label } : c)) });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    onSave(values);
  }

  return (
    <form onSubmit={submit} aria-label="Questions" className="flex flex-col">
      <div className="flex flex-col gap-6 px-5 py-6 sm:px-7">
        <Field id={id("intro")} label="Intro" hint="Shown above the questions. Plain text; a blank line starts a new paragraph.">
          <textarea id={id("intro")} rows={3} maxLength={1200} value={values.intro} disabled={busy} aria-describedby={`${id("intro")}-hint`}
            onChange={(e) => { const intro = e.currentTarget.value; setValues((v) => ({ ...v, intro })); }} className={fieldClass} />
        </Field>

        <ol className="flex flex-col gap-4">
          {qs.map((q, index) => {
            const n = index + 1;
            const qid = (field: string) => id(`${q.uid}-${field}`);
            return (
              <li key={q.uid}>
                <fieldset className="relative flex flex-col gap-4 rounded-md bg-app-sunken p-4 sm:p-5">
                  {/* Floated so the legend sits inside the padding like any block (a rendered legend straddles the border). */}
                  <legend className="float-left w-full min-h-10 pr-32 text-sm/10 font-medium text-ink">Question {n}</legend>
                  <div className="absolute top-4 right-3 flex items-center sm:top-5 sm:right-4">
                      <button type="button" className={iconButton} disabled={busy || index === 0} aria-label={`Move question ${n} up`} onClick={() => move(index, -1)}><Icon name="arrow-up" className="size-4.5" /></button>
                      <button type="button" className={iconButton} disabled={busy || index === qs.length - 1} aria-label={`Move question ${n} down`} onClick={() => move(index, 1)}><Icon name="arrow-down" className="size-4.5" /></button>
                      <button type="button" className={iconButton} disabled={busy || qs.length <= 1} aria-label={`Remove question ${n}`} onClick={() => remove(q, n)}><Icon name="trash" className="size-4.5" /></button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1fr_15rem]">
                    <Field id={qid("label")} label="Question">
                      <input id={qid("label")} required maxLength={300} value={q.label} disabled={busy} placeholder="What should we ask?"
                        onChange={(e) => patch(q.uid, { label: e.currentTarget.value })} className={fieldClass} />
                    </Field>
                    <Field id={qid("type")} label="Answer type">
                      <select id={qid("type")} value={q.type} disabled={busy} onChange={(e) => setType(q, e.currentTarget.value as QuestionType)} className={fieldClass}>
                        {TYPE_GROUPS.map(([group, types]) => (
                          <optgroup key={group} label={group}>{types.map(([t, label]) => <option key={t} value={t}>{label}</option>)}</optgroup>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {q.help || openHelp.has(q.uid)
                    ? (
                      <Field id={qid("help")} label="Help text (optional)" hint="A short note under the question.">
                        <input id={qid("help")} maxLength={500} value={q.help} disabled={busy} aria-describedby={`${qid("help")}-hint`}
                          onChange={(e) => patch(q.uid, { help: e.currentTarget.value })} className={fieldClass} />
                      </Field>
                    )
                    : (
                      <button type="button" className={cn(linkClass, "w-fit")} disabled={busy}
                        onClick={() => { setOpenHelp((s) => new Set(s).add(q.uid)); setFocusField(qid("help")); }}>Add help text</button>
                    )}
                  {NEEDS_CHOICES.has(q.type) && (
                    <fieldset className="flex flex-col gap-2">
                      <legend className="float-left w-full text-[13px] font-medium text-ink">Choices</legend>
                      {q.choices.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input aria-label={`Question ${n}, choice ${i + 1}`} maxLength={200} value={c.label} disabled={busy} required={i === 0}
                            onChange={(e) => setChoice(q, i, e.currentTarget.value)} className={cn(fieldClass, "min-w-0 flex-1")} />
                          <button type="button" className={iconButton} disabled={busy || q.choices.length <= 1} aria-label={`Remove choice ${i + 1} of question ${n}`}
                            onClick={() => patch(q.uid, { choices: q.choices.filter((_, j) => j !== i) })}><Icon name="x" className="size-4" /></button>
                        </div>
                      ))}
                      <button type="button" className={cn(secondaryButton, "w-fit")} disabled={busy || q.choices.length >= 40}
                        onClick={() => patch(q.uid, { choices: [...q.choices, { value: "", label: "" }] })}>
                        <Icon name="plus" className="size-4" />Add choice
                      </button>
                    </fieldset>
                  )}
                  <Switch label="Required" checked={q.required} disabled={busy} onChange={(e) => { const required = e.currentTarget.checked; patch(q.uid, { required }); }} />
                </fieldset>
              </li>
            );
          })}
        </ol>
        <button type="button" className={cn(secondaryButton, "w-fit")} disabled={busy || qs.length >= 80} onClick={add}>
          <Icon name="plus" className="size-4" />Add question
        </button>

        <Field id={id("thanks")} label="Thank-you message" hint="Shown after someone sends their answers.">
          <textarea id={id("thanks")} rows={2} maxLength={600} value={values.thanks} disabled={busy} aria-describedby={`${id("thanks")}-hint`}
            onChange={(e) => { const thanks = e.currentTarget.value; setValues((v) => ({ ...v, thanks })); }} className={fieldClass} />
        </Field>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-app-line bg-app px-5 py-3.5 sm:px-7">
        {error
          ? <p role="alert" className="text-sm text-danger">{error}</p>
          : <p role="status" className="text-sm text-app-muted">{dirty ? "Unsaved changes" : saved ? "Saved. Visitors see these questions now." : "No unsaved changes"}</p>}
        <div className="flex flex-wrap gap-2.5">
          {dirty && <button type="button" className={secondaryButton} disabled={busy} onClick={() => setValues(initial)}>Discard changes</button>}
          <button type="submit" className={primaryButton} disabled={busy || !dirty}>Save questions</button>
        </div>
      </div>
    </form>
  );
}
