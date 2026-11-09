// Server-only: /contact messages and /partnerships inquiries. Anyone may write; each is stored in inbox_messages
// (the /admin inbox, migration 0002) and emailed (plain text) to every admin, with the sender's address in the body
// for a reply. A filled honeypot gets the same success with nothing stored or sent.
import type { Ctx } from "@/server/context.server";
import { AccessError } from "@/server/guard";
import { notifyAdmins, oneLine } from "@/server/notify";
import { bad, isObject } from "@/server/validate";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";
import { checkContact, checkPartnership, type ContactInput, type PartnershipInput } from "./schema";

export type InboxKind = "contact" | "partnership";

const replyLine = (email: string, form: string) => `Reply to ${email} (this message came from the ${form} form, not from their address).`;

export function contactEmail(input: ContactInput): { subject: string; text: string } {
  return {
    subject: oneLine(`Contact form: ${input.topic} — ${input.name}`),
    text: [`From: ${oneLine(input.name)} <${input.email}>`, `About: ${input.topic}`, "", input.message, "", replyLine(input.email, "contact")].join("\n"),
  };
}

export function partnershipEmail(input: PartnershipInput): { subject: string; text: string } {
  return {
    subject: oneLine(`Partnership inquiry: ${input.collaboration_type} — ${input.name}`),
    text: [
      `From: ${oneLine(input.name)} <${input.email}>`,
      ...(input.business ? [`Business: ${oneLine(input.business)}`] : []),
      `Wants to: ${input.collaboration_type}`,
      "", input.message, "", replyLine(input.email, "partnerships"),
    ].join("\n"),
  };
}

/** True when the hidden honeypot field has anything in it: a bot, so pretend it worked. */
const isBot = (input: Record<string, unknown>) => input.honeypot !== undefined && input.honeypot !== "" && input.honeypot !== null;

/**
 * Checks, stores, then emails every admin. Stored is success: a failed or unconfigured email never loses the
 * message, which waits in the /admin inbox. A honeypot hit returns before anything is stored or sent.
 */
export async function receiveMessage({ db }: Ctx, kind: InboxKind, input: unknown): Promise<void> {
  if (!isObject(input)) throw bad("message");
  if (isBot(input)) return;
  let email: { subject: string; text: string };
  if (kind === "contact") {
    const checked = checkContact(input);
    if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
    const v = checked.value;
    db.prepare("insert into inbox_messages (kind, name, email, topic, message) values ('contact', ?, ?, ?, ?)").run(v.name, v.email, v.topic, v.message);
    email = contactEmail(v);
  } else {
    const checked = checkPartnership(input);
    if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
    const v = checked.value;
    db.prepare("insert into inbox_messages (kind, name, email, business, collaboration_type, message) values ('partnership', ?, ?, ?, ?, ?)")
      .run(v.name, v.email, v.business || null, v.collaboration_type, v.message);
    email = partnershipEmail(v);
  }
  if (!(await notifyAdmins(db, email))) console.warn(`[inbox] ${kind} message stored, but no admin email went out`);
}

/** 5 per client IP per 10 minutes, counted separately for each form (as the old forms service did). */
const limits: Record<InboxKind, ReturnType<typeof rateLimit>> = {
  contact: rateLimit(5, 10 * 60 * 1000),
  partnership: rateLimit(5, 10 * 60 * 1000),
};

/** POST /api/contact or /api/partnerships (JSON, ≤ 16 KB): size and the per-IP limit are checked before the body is read. */
export function inboxRequest(c: Ctx, request: Request, kind: InboxKind): Promise<Response> {
  return respond(async () => {
    checkSize(request, 16 * 1024);
    if (!limits[kind](clientIp(request.headers))) throw new HttpError("Too many messages from here. Please try again later.", 429);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw bad("message");
    }
    await receiveMessage(c, kind, input);
  });
}
