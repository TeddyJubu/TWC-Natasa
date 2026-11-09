// Server-only: emailing the admins, and short confirmation emails to a submitter. Every alert (new contact message,
// partnership inquiry, application, member review, Spotlight answer) and every confirmation goes through sendEmail() —
// so a missing Cloudflare config or a failed send never fails a request.
import type { DB } from "./db";
import { sendEmail, type Email } from "./email";

/** Header-safe: no CR/LF, other control characters or Unicode line breaks can reach a subject line. */
export const oneLine = (s: string) => s.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").trim();

/**
 * First word of a name for "Hi …," — only when it looks like a plain name (letters / apostrophe / hyphen / period,
 * ≤ 60 chars, no URL-ish or address-ish text). Otherwise "there", so a forged name can't inject a link into the greeting.
 */
export function firstName(name: string): string {
  const word = oneLine(name).split(/\s+/).find(Boolean) ?? "";
  if (!word || word.length > 60 || /[@/\\<>]|https?:|www\./i.test(word)) return "there";
  if (!/^[\p{L}][\p{L}'’.-]*$/u.test(word)) return "there";
  return word;
}

/** Fixed footer on every confirmation: explains why they got it, and that a stranger can ignore it. */
export const confirmFooter = (form: string) =>
  `You're getting this because this address was used on our ${form}. If that wasn't you, you can ignore this email; we won't write again unless you do.\n\nThe Women's Collective\n`;

const adminAddresses = (db: DB) =>
  (db.prepare(`select distinct u.email from "user" u join user_roles r on r.user_id = u.id where r.role = 'admin'`).all() as { email: string }[]).map((a) => a.email);

/** Emails every admin separately; true when at least one went out. Callers store first, so false is a warning, not an error. */
export async function notifyAdmins(db: DB, { subject, text }: Pick<Email, "subject" | "text">): Promise<boolean> {
  const results = await Promise.all(adminAddresses(db).map((to) => sendEmail({ to, subject, text })));
  return results.some((r) => r.sent);
}

/**
 * One plain-text confirmation to the submitter. Never throws: callers have already stored the row, and a mail failure
 * must not undo that (OPS-524 — a failed send does not burn the address; the next submit can try again).
 */
export async function confirmSubmitter(mail: Email, log: string): Promise<void> {
  try {
    if (!(await sendEmail(mail)).sent) console.warn(`${log} stored, but the confirmation email did not go out`);
  } catch {
    console.warn(`${log} stored, but the confirmation email failed`);
  }
}
