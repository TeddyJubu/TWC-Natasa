// What the /join form keeps and checks in the browser: a local draft of its answers, and every error at once.
import { createContext } from "react";
import { DATE_ERROR, EMAIL, isSigningDate } from "./schema";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export type DraftValues = Record<string, string[]>;
export type FieldError = { key: string; targetId: string; question: string; message: string };

/** The errors a form is showing, by field name. Forms that don't provide it keep their native validation. */
export const FieldErrors = createContext<ReadonlyMap<string, string>>(new Map());

const controls = (form: HTMLFormElement) =>
  [...form.elements].filter((el): el is Control => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement);
const isBox = (el: Control): el is HTMLInputElement => el.type === "checkbox" || el.type === "radio";

/** One draft per browser, not per area: switching area keeps the form and its answers. */
const DRAFT_KEY = "twc-join-draft";
/** A draft holds personal details on a possibly shared device, so it doesn't outlive a month. */
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Given fresh each time: the signature and its date, the marketing opt-in. `Check` boxes (every consent) are skipped below. */
const NEVER_SAVED = new Set(["fax-number", "area", "signature", "date", "newsletter"]);
const isSaved = (el: Control) => !!el.name && !NEVER_SAVED.has(el.name) && !el.closest(".twc-check");

export function collectDraft(form: HTMLFormElement): DraftValues {
  const values: DraftValues = {};
  for (const el of controls(form).filter(isSaved)) {
    if (isBox(el) ? el.checked : el.value) (values[el.name] ??= []).push(el.value);
  }
  return values;
}

/** Restores saved answers. Text the applicant has already typed stays. */
export function applyDraft(form: HTMLFormElement, values: DraftValues) {
  for (const el of controls(form).filter(isSaved)) {
    const saved = values[el.name];
    if (!saved) continue;
    if (isBox(el)) el.checked = saved.includes(el.value);
    else if (!el.value) el.value = saved[0] ?? "";
  }
}

export function canStoreDrafts(): boolean {
  try {
    localStorage.setItem("twc-join-draft:probe", "1");
    localStorage.removeItem("twc-join-draft:probe");
    return true;
  } catch {
    return false;
  }
}

export function saveDraft(values: DraftValues, now = Date.now()): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: now, values }));
    return true;
  } catch {
    return false;
  }
}

export function readDraft(now = Date.now()): DraftValues | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { savedAt, values } = JSON.parse(raw) as { savedAt?: unknown; values?: unknown };
    if (typeof savedAt !== "number" || now - savedAt > DRAFT_MAX_AGE_MS || typeof values !== "object" || values === null) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return Object.fromEntries(Object.entries(values).flatMap(([name, list]) =>
      (Array.isArray(list) && list.every((v) => typeof v === "string") ? [[name, list as string[]]] : [])));
  } catch {
    return null;
  }
}

export function clearDrafts() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // No storage means no draft to clear.
  }
}

/** One error per `Check` box (they can share a name); one per field or choice group otherwise. */
export const checkErrorKey = (name: unknown, value: unknown) => `${String(name)}:${String(value ?? "on")}`;

function messageFor(el: Control): string | null {
  if (el.name === "date") return isSigningDate(el.value) ? null : DATE_ERROR;
  if (el.validity.customError) return el.validationMessage;
  if (el.type === "checkbox" && el.validity.valueMissing) return "Tick this box to continue.";
  if (el.validity.valueMissing || (el.required && !el.value.trim())) return "Please answer this question.";
  if (el.name === "email" && !EMAIL.test(el.value.trim())) return "Enter an email like name@example.com.";
  if (el.validity.typeMismatch) return el.type === "email" ? "Enter an email like name@example.com." : "Enter a full web address, starting with https://.";
  return el.validity.valid ? null : el.validationMessage;
}

/** Every unanswered or malformed field, in page order. */
export function collectErrors(form: HTMLFormElement): FieldError[] {
  return controls(form).flatMap((el) => {
    if (!el.willValidate) return [];
    const message = messageFor(el);
    if (!message) return [];
    const question = el.closest<HTMLElement>("[data-question]")?.dataset.question ?? el.labels?.[0]?.textContent?.trim() ?? el.name;
    return [{ key: el.closest(".twc-check") ? checkErrorKey(el.name, el.value) : el.name, targetId: el.id, question, message }];
  });
}
