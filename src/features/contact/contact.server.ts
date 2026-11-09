// Server-only: /contact messages. Anyone may write; the message is emailed (plain text) to every admin, with the
// sender's address in the body for a reply. Nothing is stored.
import type { Ctx } from "@/server/context.server";
import { sendEmail } from "@/server/email";
import { AccessError } from "@/server/guard";
import { bad, isObject } from "@/server/validate";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";
import { checkContact, type ContactInput } from "./schema";

/** Header-safe: no CR/LF, other control characters or Unicode line breaks can reach a subject line. */
const oneLine = (s: string) => s.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").trim();

export function contactEmail(input: ContactInput): { subject: string; text: string } {
  return {
    subject: oneLine(`Contact form: ${input.topic} — ${input.name}`),
    text: [
      `From: ${oneLine(input.name)} <${input.email}>`,
      `About: ${input.topic}`,
      "",
      input.message,
      "",
      `Reply to ${input.email} (this message came from the contact form, not from their address).`,
    ].join("\n"),
  };
}

/** Sends the message to every admin; true when at least one send succeeded. */
export async function sendContact({ db }: Ctx, input: unknown): Promise<boolean> {
  if (!isObject(input)) throw bad("message");
  const checked = checkContact(input);
  if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
  const admins = db.prepare(`select distinct u.email from "user" u join user_roles r on r.user_id = u.id where r.role = 'admin'`)
    .all() as { email: string }[];
  const email = contactEmail(checked.value);
  const results = await Promise.all(admins.map(({ email: to }) => sendEmail({ to, ...email })));
  return results.some((r) => r.sent);
}

/** 5 messages per client IP per 10 minutes. */
const allow = rateLimit(5, 10 * 60 * 1000);

/** POST /api/contact (JSON, ≤ 16 KB): size and the per-IP limit are checked before the body is read. */
export function sendContactRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, 16 * 1024);
    if (!allow(clientIp(request.headers))) throw new HttpError("Too many messages from here. Please try again later.", 429);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw bad("message");
    }
    if (!(await sendContact(c, input))) {
      throw new HttpError("We couldn’t send your message just now. Please try again in a little while.", 503);
    }
  });
}
