// A custom form's questions on the scrapbook kit: native validation first, then the shared check, then POST
// /api/forms/<slug>. `onSent` moves on to the thank-you page.
import * as React from "react";
import { Icon } from "@/app/layout/twc";
import { Choices, Field, Input, LongAnswer, Notice, Select } from "@/features/applications/twc-fields";
import { sendFormAnswers, type FormSubmission, type PublicForm } from "./queries";
import { checkAnswers, choicesOf, MAX_VALUE, type Answers, type Question } from "./schema";

const INPUT: Partial<Record<Question["type"], { type: string; autoComplete?: string; inputMode?: "decimal" }>> = {
  short: { type: "text" }, email: { type: "email", autoComplete: "email" }, phone: { type: "tel", autoComplete: "tel" },
  url: { type: "url" }, number: { type: "text", inputMode: "decimal" }, date: { type: "date" },
};

function QuestionField({ q }: { q: Question }) {
  const id = `q-${q.key}`;
  const optional = !q.required;
  if (q.type === "radio" || q.type === "yesno" || q.type === "checkboxes") {
    return <Choices type={q.type === "checkboxes" ? "checkbox" : "radio"} name={q.key} legend={q.label} options={choicesOf(q)} hint={q.help} optional={optional} required={q.required} />;
  }
  if (q.type === "dropdown") {
    return (
      <Field id={id} label={q.label} optional={optional} hint={q.help}>
        <Select name={q.key} required={q.required} defaultValue="">
          <option value="">Choose…</option>
          {choicesOf(q).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </Field>
    );
  }
  if (q.type === "paragraph") {
    return <Field id={id} label={q.label} optional={optional} hint={q.help}><LongAnswer name={q.key} required={q.required} rows={5} maxLength={MAX_VALUE} /></Field>;
  }
  return <Field id={id} label={q.label} optional={optional} hint={q.help}><Input name={q.key} required={q.required} maxLength={MAX_VALUE} {...INPUT[q.type]} /></Field>;
}

export function CustomForm({ form, onSent, send = sendFormAnswers }: {
  form: PublicForm; onSent: () => void; send?: (slug: string, input: FormSubmission) => Promise<void>;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const alert = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const answers: Answers = {};
    for (const q of form.questions) {
      if (q.type === "checkboxes") answers[q.key] = data.getAll(q.key).map(String);
      else answers[q.key] = String(data.get(q.key) ?? "");
    }
    const checked = checkAnswers(form.questions, answers);
    if ("errors" in checked) {
      setFailure(Object.values(checked.errors)[0]!);
      return;
    }
    setFailure(null);
    setBusy(true);
    try {
      await send(form.slug, { answers: checked.value, honeypot: String(data.get("honeypot") ?? "") });
      onSent();
    } catch (error) {
      setFailure((error as Error).message || "We couldn’t send your answers just now. Please try again in a little while.");
      setBusy(false);
    }
  }

  return (
    <form className="relative flex flex-col gap-[22px] rounded-[6px] bg-sb-paper p-5 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] sm:p-12" onSubmit={submit} aria-busy={busy}>
      {form.questions.map((q) => <QuestionField key={q.key} q={q} />)}
      {/* Honeypot: off-screen and out of the tab order and accessibility tree; people never fill it, bots do. */}
      <p aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>If you can see this, leave it empty <input name="honeypot" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </p>
      {failure && (
        <Notice ref={alert} tabIndex={-1} role="alert" tone="danger" title="One more thing" className="outline-none">
          <p>{failure}</p>
        </Notice>
      )}
      <div>
        <button type="submit" aria-disabled={busy || undefined} className="twc-btn aria-disabled:cursor-progress">Send <Icon name="arrow" className="twc-arrow" /></button>
      </div>
    </form>
  );
}
