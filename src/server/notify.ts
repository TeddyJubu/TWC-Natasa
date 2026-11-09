// Server-only: emailing the admins. Every alert (new contact message, partnership inquiry, application, member review,
// Spotlight answer) goes through notifyAdmins(), which goes through sendEmail() — so a missing Cloudflare config or a
// failed send never fails a request.
import type { DB } from "./db";
import { sendEmail, type Email } from "./email";

/** Header-safe: no CR/LF, other control characters or Unicode line breaks can reach a subject line. */
export const oneLine = (s: string) => s.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").trim();

const adminAddresses = (db: DB) =>
  (db.prepare(`select distinct u.email from "user" u join user_roles r on r.user_id = u.id where r.role = 'admin'`).all() as { email: string }[]).map((a) => a.email);

/** Emails every admin separately; true when at least one went out. Callers store first, so false is a warning, not an error. */
export async function notifyAdmins(db: DB, { subject, text }: Pick<Email, "subject" | "text">): Promise<boolean> {
  const results = await Promise.all(adminAddresses(db).map((to) => sendEmail({ to, subject, text })));
  return results.some((r) => r.sent);
}
