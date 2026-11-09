// Custom forms (/f/<slug>): the question model and the answer checks, shared by the page and the server. No imports,
// so scripts/seed-forms.ts can load it under plain Node. The server re-runs checkAnswers on every POST.

export const QUESTION_TYPES = ["short", "email", "phone", "url", "number", "date", "paragraph", "dropdown", "radio", "checkboxes", "yesno"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Choice = { value: string; label: string };
export type Question = { key: string; type: QuestionType; label: string; required?: boolean; help?: string; choices?: Choice[] };
/** Stored answers, by question key: one string, or the picked values of a checkboxes question. */
export type Answers = Record<string, string | string[]>;

/** The old forms service's limits: KEY_RE, CHOICE_RE, MAX_VALUE, and 80 names per form. */
const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const CHOICE = /^[a-z0-9][a-z0-9_-]{0,59}$/;
export const MAX_QUESTIONS = 80;
export const MAX_CHOICES = 40;
export const MAX_VALUE = 4000;
/** Same rule as the contact form and the applications.email check. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const YES_NO: Choice[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
const PICK_ONE = new Set<QuestionType>(["dropdown", "radio", "yesno"]);
export const choicesOf = (q: Question): Choice[] => (q.type === "yesno" ? YES_NO : q.choices ?? []);

/** Plain-text intro, thank-you and closed words, as paragraphs (split on blank lines). */
export const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** A form's questions, checked where a definition is written (seeds, the importer, later the builder); throws the first problem. */
export function checkQuestions(input: unknown): Question[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_QUESTIONS) throw new Error(`A form needs 1 to ${MAX_QUESTIONS} questions.`);
  const keys = new Set<string>();
  return input.map((raw, i): Question => {
    const where = `Question ${i + 1}`;
    if (typeof raw !== "object" || raw === null) throw new Error(`${where} isn’t a question.`);
    const { key, type, label, required, help, choices } = raw as Record<string, unknown>;
    if (typeof key !== "string" || !KEY.test(key) || keys.has(key)) throw new Error(`${where} needs its own key (a–z, 0–9, _).`);
    keys.add(key);
    if (!QUESTION_TYPES.includes(type as QuestionType)) throw new Error(`${where} has an unknown type.`);
    if (typeof label !== "string" || !label.trim() || label.length > 300) throw new Error(`${where} needs a label of up to 300 characters.`);
    if (help !== undefined && (typeof help !== "string" || help.length > 500)) throw new Error(`${where}’s help is too long.`);
    const q: Question = { key, type: type as QuestionType, label: label.trim(), required: required === true, ...(help ? { help } : {}) };
    if (type === "dropdown" || type === "radio" || type === "checkboxes") {
      const list = Array.isArray(choices) ? choices : [];
      const ok = list.length >= 1 && list.length <= MAX_CHOICES && list.every((c) =>
        typeof c?.value === "string" && CHOICE.test(c.value) && typeof c.label === "string" && c.label.trim() && c.label.length <= 200);
      if (!ok || new Set(list.map((c) => c.value)).size !== list.length) throw new Error(`${where} needs 1 to ${MAX_CHOICES} choices, each with its own value.`);
      q.choices = list.map((c) => ({ value: c.value, label: c.label.trim() }));
    }
    return q;
  });
}

/** Whether a trimmed, non-empty answer fits its question's type. */
function fits(q: Question, v: string): boolean {
  switch (q.type) {
    case "email": return v.length <= 254 && EMAIL.test(v);
    case "url": return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v);
    case "phone": return /^[0-9+().\s-]{7,30}$/.test(v);
    case "number": return /^-?\d{1,15}(\.\d{1,6})?$/.test(v);
    case "date": return /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
    case "short": return !/[\r\n]/.test(v);
    default: return PICK_ONE.has(q.type) ? choicesOf(q).some((c) => c.value === v) : true;
  }
}

const HOW: Partial<Record<QuestionType, string>> = {
  email: "it should look like name@example.com", url: "it should start with https://", phone: "it should be a phone number",
  number: "it should be a number", date: "it should be a date", short: "it should be one line",
};

/**
 * The answers to keep, by question key, plus the first email-type answer lower-cased (the old email_key); or one
 * message per question. Keys that aren't the form's questions (honeypot, form-*, anything else) are dropped (OPS-205).
 */
export function checkAnswers(questions: Question[], input: Record<string, unknown>): { value: Answers; email: string | null } | { errors: Record<string, string> } {
  const value: Answers = {};
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const raw = input[q.key];
    if (q.type === "checkboxes") {
      const picked = raw === undefined || raw === null ? [] : Array.isArray(raw) ? raw : [raw];
      if (!picked.every((v) => typeof v === "string" && choicesOf(q).some((c) => c.value === v))) errors[q.key] = `Please choose from the options for “${q.label}”.`;
      else if (q.required && picked.length === 0) errors[q.key] = `Please choose at least one option for “${q.label}”.`;
      else if (picked.length) value[q.key] = [...new Set(picked as string[])];
      continue;
    }
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      errors[q.key] = `Please check “${q.label}”.`;
      continue;
    }
    const v = (raw ?? "").trim();
    if (!v) {
      if (q.required) errors[q.key] = PICK_ONE.has(q.type) ? `Please choose an option for “${q.label}”.` : `Please answer “${q.label}”.`;
    } else if (v.length > MAX_VALUE) errors[q.key] = `Please shorten “${q.label}” (up to ${MAX_VALUE} characters).`;
    else if (!fits(q, v)) errors[q.key] = PICK_ONE.has(q.type) ? `Please choose one of the options for “${q.label}”.` : `Please check “${q.label}”: ${HOW[q.type]}.`;
    else value[q.key] = v;
  }
  if (Object.keys(errors).length) return { errors };
  const emailKey = questions.find((q) => q.type === "email")?.key;
  const email = emailKey && typeof value[emailKey] === "string" ? (value[emailKey] as string).toLowerCase() : null;
  return { value, email };
}
