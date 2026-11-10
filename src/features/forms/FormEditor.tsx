// The sheet on a custom form's Questions tab: the form as visitors see it, on paper, with every word edited in place —
// title, intro, questions (choices as the pills visitors tap) and the thank-you. Keys and choice values are made in
// form-draft.ts and never shown; the link, open/closed and the closed message live on the Settings tab, so saving the
// sheet can never undo them. Writes go through saveAdminForm → saveForm / checkQuestions.
import * as React from "react";
import { cn } from "@/index";
import { primaryButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import type { QuestionType } from "./schema";
import { blankQuestion, NEEDS_CHOICES, sameQuestions, type DraftQuestion, type QuestionsDraft } from "./form-draft";

/** Question types in the words a visitor would use, grouped as in the picker. */
const TYPE_GROUPS: [group: string, types: [QuestionType, string][]][] = [
  ["Text", [["short", "Short answer"], ["paragraph", "Long answer"], ["email", "Email address"], ["phone", "Phone number"], ["url", "Website link"], ["number", "Number"], ["date", "Date"]]],
  ["Choice", [["radio", "Pick one"], ["dropdown", "Pick one from a list"], ["checkboxes", "Pick any"], ["yesno", "Yes or no"]]],
];
/** What the empty answer box says for each text type. */
const GHOST: Partial<Record<QuestionType, string>> = {
  short: "Short answer", paragraph: "Long answer", email: "name@example.com", phone: "Phone number", url: "https://", number: "0", date: "mm / dd / yyyy",
};
const CHOICE_NOTE: Partial<Record<QuestionType, string>> = {
  radio: "Visitors pick one.", checkboxes: "Visitors can pick any number.", dropdown: "Shown as a drop-down list; visitors pick one.",
};

/** Words edited in place: no box until you point at them (a dashed rule) or type in them (the focus ring). */
const ghost = cn("w-full resize-none rounded-sm border-b border-dashed border-transparent bg-transparent text-ink [field-sizing:content] placeholder:text-app-muted/85 hover:border-app-muted/60 focus:border-transparent disabled:opacity-60", ring);
const iconButton = cn("grid size-9 shrink-0 place-items-center rounded-full text-app-muted transition-colors duration-150 hover:bg-ink/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-app-muted", ring);
const pill = "inline-flex min-h-11 items-center rounded-full bg-app font-display text-[15px]/[1.3] text-ink shadow-[inset_0_0_0_1px_var(--color-app-line)]";

/** Rows for a textarea where `field-sizing` isn't supported: wrapped lines at about `perLine` characters. */
const rowsFor = (text: string, perLine: number) => text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
const oneLine = (text: string) => text.replace(/\s*\n\s*/g, " ");

/** A compact on/off switch for inside a question (the card-row `Toggle` is for settings rows). */
function Switch({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
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
  const dirty = !sameQuestions(values, initial);
  const id = (field: string) => `${idPrefix}-${field}`;
  const qs = values.questions;

  // Leaving the page with unsaved words asks first (the browser's own prompt).
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // A newly added question or choice gets focus.
  React.useEffect(() => {
    if (!focusField) return;
    document.getElementById(focusField)?.focus();
    setFocusField(null);
  }, [focusField]);

  const set = (p: Partial<QuestionsDraft>) => setValues((v) => ({ ...v, ...p }));
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
  const addChoice = (q: DraftQuestion) => {
    if (q.choices.length >= 40) return;
    patch(q.uid, { choices: [...q.choices, { value: "", label: "" }] });
    setFocusField(id(`${q.uid}-choice-${q.choices.length}`));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    onSave(values);
  }
  // Enter in a one-line box never saves the live form by accident; only the Save button does.
  const noEnterSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "checkbox") e.preventDefault();
  };
  const noNewline = (e: React.KeyboardEvent) => { if (e.key === "Enter") e.preventDefault(); };

  return (
    <form onSubmit={submit} onKeyDown={noEnterSubmit} aria-label="Questions" className="mx-auto flex w-full max-w-185 flex-col">
      <p className="mb-2 px-1 font-script text-[26px]/[1.2] text-app-accent">psst — click any words to change them</p>

      <div className="flex flex-col gap-7 rounded-md bg-app px-5 py-8 shadow-[0_10px_28px_color-mix(in_srgb,var(--color-ink)_12%,transparent)] sm:px-12 sm:py-12">
        <div className="flex flex-col gap-3">
          <textarea aria-label="Form name" required maxLength={80} rows={rowsFor(values.name, 26)} value={values.name} disabled={busy} placeholder="Name your form"
            onKeyDown={noNewline} onChange={(e) => set({ name: oneLine(e.currentTarget.value) })}
            className={cn(ghost, "font-display text-[32px]/[1.15] tracking-[-0.5px] sm:text-[40px]/[1.1]")} />
          <textarea aria-label="Intro" maxLength={1200} rows={Math.max(2, rowsFor(values.intro, 70))} value={values.intro} disabled={busy}
            placeholder="Add an intro: a line or two about what this is for. A blank line starts a new paragraph."
            onChange={(e) => set({ intro: e.currentTarget.value })} className={cn(ghost, "text-base/[1.6]")} />
        </div>

        <ol className="flex flex-col gap-1">
          {qs.map((q, index) => {
            const n = index + 1;
            const qid = (field: string) => id(`${q.uid}-${field}`);
            return (
              <li key={q.uid}>
                <fieldset className="-mx-3 rounded-md px-3 py-4 transition-colors duration-150 focus-within:bg-app-sunken sm:-mx-5 sm:px-5">
                  <legend className="sr-only">Question {n}</legend>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <span aria-hidden className="twc-index w-6 shrink-0 pt-1.5 tabular-nums sm:w-7">{String(n).padStart(2, "0")}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                      <div className="flex items-start gap-1">
                        <textarea id={qid("label")} aria-label="Question" required maxLength={300} rows={rowsFor(q.label, 44)} value={q.label} disabled={busy} placeholder="Type your question"
                          onKeyDown={noNewline} onChange={(e) => patch(q.uid, { label: oneLine(e.currentTarget.value) })}
                          className={cn(ghost, "min-w-0 flex-1 py-1 text-[17px]/[1.4] font-medium")} />
                        <div className="flex shrink-0 items-center">
                          <button type="button" className={iconButton} disabled={busy || index === 0} aria-label={`Move question ${n} up`} onClick={() => move(index, -1)}><Icon name="arrow-up" className="size-4" /></button>
                          <button type="button" className={iconButton} disabled={busy || index === qs.length - 1} aria-label={`Move question ${n} down`} onClick={() => move(index, 1)}><Icon name="arrow-down" className="size-4" /></button>
                          <button type="button" className={iconButton} disabled={busy || qs.length <= 1} aria-label={`Remove question ${n}`} onClick={() => remove(q, n)}><Icon name="trash" className="size-4" /></button>
                        </div>
                      </div>
                      <input aria-label="Help text (optional)" maxLength={500} value={q.help} disabled={busy} placeholder="Add a note (optional)"
                        onChange={(e) => patch(q.uid, { help: e.currentTarget.value })} className={cn(ghost, "text-[13px]/[1.5] text-app-muted")} />

                      {NEEDS_CHOICES.has(q.type)
                        ? (
                          <div role="group" aria-label={`Question ${n} choices`} className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              {q.choices.map((c, i) => (
                                <span key={i} className={cn(pill, "gap-0.5 pr-1 pl-4.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-app-accent")}>
                                  <input id={qid(`choice-${i}`)} aria-label={`Question ${n}, choice ${i + 1}`} maxLength={200} value={c.label} disabled={busy} required={i === 0}
                                    size={Math.max(c.label.length, c.label ? 2 : 6)} placeholder="Choice"
                                    onChange={(e) => setChoice(q, i, e.currentTarget.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChoice(q); } }}
                                    className="max-w-[60vw] min-w-[2ch] bg-transparent outline-none [field-sizing:content] placeholder:text-app-muted/85 sm:max-w-[40ch]" />
                                  <button type="button" disabled={busy || q.choices.length <= 1} aria-label={`Remove choice ${i + 1} of question ${n}`}
                                    onClick={() => patch(q.uid, { choices: q.choices.filter((_, j) => j !== i) })}
                                    className={cn(iconButton, "size-8")}><Icon name="x" className="size-3.5" /></button>
                                </span>
                              ))}
                              <button type="button" disabled={busy || q.choices.length >= 40} onClick={() => addChoice(q)}
                                className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-app-muted/60 px-4 font-display text-[15px]/[1.3] text-app-muted transition-colors duration-150 hover:border-ink hover:text-ink disabled:opacity-50", ring)}>
                                <Icon name="plus" className="size-3.5" />Add choice
                              </button>
                            </div>
                            <p className="text-[13px] text-app-muted">{CHOICE_NOTE[q.type]}</p>
                          </div>
                        )
                        : q.type === "yesno"
                          ? <div aria-hidden className="flex gap-2">{["Yes", "No"].map((c) => <span key={c} className={cn(pill, "px-4.5")}>{c}</span>)}</div>
                          : <div aria-hidden className={cn("twc-input pointer-events-none text-app-muted/85 select-none", q.type === "paragraph" && "min-h-28")}>{GHOST[q.type]}</div>}

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-0.5">
                        <label className="flex items-center gap-2 text-[13px] text-app-muted">
                          Answer type
                          <select value={q.type} disabled={busy} onChange={(e) => setType(q, e.currentTarget.value as QuestionType)}
                            className={cn("min-h-9 cursor-pointer rounded-full bg-app py-1 pr-2 pl-3 text-[13px] text-ink shadow-[inset_0_0_0_1px_var(--color-app-line)] disabled:opacity-60", ring)}>
                            {TYPE_GROUPS.map(([group, types]) => (
                              <optgroup key={group} label={group}>{types.map(([t, label]) => <option key={t} value={t}>{label}</option>)}</optgroup>
                            ))}
                          </select>
                        </label>
                        <Switch label="Required" checked={q.required} disabled={busy} onChange={(e) => { const required = e.currentTarget.checked; patch(q.uid, { required }); }} />
                      </div>
                    </div>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>

        <button type="button" disabled={busy || qs.length >= 80} onClick={add}
          className={cn("flex min-h-14 w-full items-center justify-center gap-2 rounded-md border border-dashed border-app-muted/60 text-[15px] font-medium text-ink transition-colors duration-150 hover:border-ink hover:bg-app-sunken disabled:opacity-50", ring)}>
          <Icon name="plus" className="size-4" />Add question
        </button>

        <div className="flex flex-col gap-2 border-t border-dashed border-app-muted/60 pt-6">
          <label htmlFor={id("thanks")} className="twc-eyebrow">After they send it</label>
          <textarea id={id("thanks")} maxLength={600} rows={Math.max(2, rowsFor(values.thanks, 70))} value={values.thanks} disabled={busy}
            placeholder="Your thank-you message. Leave it blank for the standard one."
            onChange={(e) => set({ thanks: e.currentTarget.value })} className={cn(ghost, "text-base/[1.6]")} />
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-app p-2.5 shadow-[inset_0_0_0_1px_var(--color-app-line)] sm:p-3.5">
        {error
          ? <p role="alert" className="px-1.5 text-sm text-danger">{error}</p>
          : <p role="status" className="px-1.5 text-sm text-app-muted">{dirty ? "Unsaved changes" : saved ? "Saved. Visitors see this version now." : "No unsaved changes"}</p>}
        <div className="flex flex-wrap gap-2.5">
          {dirty && <button type="button" className={secondaryButton} disabled={busy} onClick={() => setValues(initial)}>Discard changes</button>}
          <button type="submit" className={primaryButton} disabled={busy || !dirty}>Save changes</button>
        </div>
      </div>
    </form>
  );
}
