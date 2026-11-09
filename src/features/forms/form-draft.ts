// Draft helpers for the admin form editor (meta + questions → checkQuestions shape).
import type { Choice, Question, QuestionType } from "./schema";

const NEEDS_CHOICES = new Set<QuestionType>(["dropdown", "radio", "checkboxes"]);

/** One editable question row (choices as `value|label` lines). */
export type DraftQuestion = {
  key: string; type: QuestionType; label: string; required: boolean; help: string; choicesText: string;
};

export type FormEditorValues = {
  name: string; slug: string; intro: string; thanks: string; closed_message: string;
  open: boolean; one_per_email: boolean; questions: DraftQuestion[];
};

export const blankQuestion = (): DraftQuestion => ({
  key: "", type: "short", label: "", required: false, help: "", choicesText: "",
});

export const starterQuestions = (): DraftQuestion[] => [
  { key: "name", type: "short", label: "Your name", required: true, help: "", choicesText: "" },
  { key: "email", type: "email", label: "Email", required: true, help: "", choicesText: "" },
];

export function draftFromQuestions(questions: Question[]): DraftQuestion[] {
  return questions.map((q) => ({
    key: q.key, type: q.type, label: q.label, required: q.required === true, help: q.help ?? "",
    choicesText: (q.choices ?? []).map((c) => `${c.value}|${c.label}`).join("\n"),
  }));
}

/** Parse `value|label` lines; a bare label gets a slugified value (checkQuestions still owns the rules). */
export function parseChoicesText(text: string): Choice[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const pipe = line.indexOf("|");
    if (pipe >= 0) return { value: line.slice(0, pipe).trim(), label: line.slice(pipe + 1).trim() };
    const value = line.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    return { value: value || "option", label: line };
  });
}

export function questionsFromDraft(draft: DraftQuestion[]): Question[] {
  return draft.map((q) => {
    const base: Question = {
      key: q.key.trim(), type: q.type, label: q.label.trim(), required: q.required,
      ...(q.help.trim() ? { help: q.help.trim() } : {}),
    };
    if (NEEDS_CHOICES.has(q.type)) base.choices = parseChoicesText(q.choicesText);
    return base;
  });
}

export { NEEDS_CHOICES };
