// Draft helpers for the admin question editor (questions → checkQuestions shape). Keys and choice values are made
// here, once, and never change afterwards: stored answers are filed under them.
import type { Choice, Question, QuestionType } from "./schema";

export const NEEDS_CHOICES = new Set<QuestionType>(["dropdown", "radio", "checkboxes"]);

/** One editable choice. `value` is "" until the choice is first saved; then it is kept. */
export type DraftChoice = { value: string; label: string };
/** One editable question; `uid` is a client-only React key, never sent. */
export type DraftQuestion = { uid: string; key: string; type: QuestionType; label: string; required: boolean; help: string; choices: DraftChoice[] };
/** What the sheet on a form's Questions tab edits: everything a visitor reads. */
export type QuestionsDraft = { name: string; intro: string; thanks: string; questions: DraftQuestion[] };

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const random = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => CHARS[b % CHARS.length]).join("");
const uid = () => random(10);

/** A fresh question key (`q_` + 6 characters, matching checkQuestions' KEY), unlike any in `taken`. */
export function newKey(taken: Iterable<string>): string {
  const used = new Set(taken);
  let key: string;
  do key = `q_${random(6)}`; while (used.has(key));
  return key;
}

/** A choice value from its label (checkQuestions' CHOICE shape), made unique against `taken`. */
export function choiceValue(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "option";
  let value = base;
  for (let n = 2; used.has(value); n++) value = `${base}-${n}`;
  return value;
}

export const blankQuestion = (taken: Iterable<string>, type: QuestionType = "short"): DraftQuestion => ({
  uid: uid(), key: newKey(taken), type, label: "", required: false, help: "",
  choices: NEEDS_CHOICES.has(type) ? [{ value: "", label: "" }, { value: "", label: "" }] : [],
});

/** What a new form starts with: name and email, both required. */
export const starterQuestions = (): Question[] => [
  { key: "name", type: "short", label: "Your name", required: true },
  { key: "email", type: "email", label: "Email", required: true },
];

export function draftFromQuestions(questions: Question[]): DraftQuestion[] {
  return questions.map((q) => ({
    uid: uid(), key: q.key, type: q.type, label: q.label, required: q.required === true, help: q.help ?? "",
    choices: (q.choices ?? []).map((c) => ({ ...c })),
  }));
}

/** The draft as checkQuestions expects it: trimmed, blank choices dropped, new choices given a value. */
export function questionsFromDraft(draft: DraftQuestion[]): Question[] {
  return draft.map((q) => {
    const base: Question = {
      key: q.key, type: q.type, label: q.label.trim(), required: q.required,
      ...(q.help.trim() ? { help: q.help.trim() } : {}),
    };
    if (NEEDS_CHOICES.has(q.type)) {
      const kept = q.choices.filter((c) => c.label.trim());
      const taken = kept.map((c) => c.value).filter(Boolean);
      base.choices = kept.map((c): Choice => {
        const value = c.value || choiceValue(c.label, taken);
        if (!c.value) taken.push(value);
        return { value, label: c.label.trim() };
      });
    }
    return base;
  });
}

/** Whether two drafts would save the same questions (ignores client-only uids). */
export const sameQuestions = (a: QuestionsDraft, b: QuestionsDraft) =>
  a.name === b.name && a.intro === b.intro && a.thanks === b.thanks && JSON.stringify(questionsFromDraft(a.questions)) === JSON.stringify(questionsFromDraft(b.questions));
