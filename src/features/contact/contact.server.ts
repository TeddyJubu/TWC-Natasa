// Server-only: /contact messages and /partnerships inquiries. Anyone may write; each is stored in inbox_messages
// (the /admin inbox, migration 0002) and emailed (plain text) to every admin, with the sender's address in the body
// for a reply. A filled honeypot gets the same success with nothing stored or sent.
import type { Ctx } from "@/server/context.server";
import { AccessError } from "@/server/guard";
import { confirmFooter, confirmSubmitter, firstName, notifyAdmins, oneLine } from "@/server/notify";
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

/** Confirmation to the contact submitter (OPS-501 subject). No admin links; never throws. */
export async function confirmContact(input: ContactInput): Promise<void> {
  const text = [
    `Hi ${firstName(input.name)},`, "",
    "Thanks for writing to The Women's Collective. We've got your message and will reply when we can.", "",
    confirmFooter("contact form"),
  ].join("\n");
  await confirmSubmitter({ to: input.email, subject: "We got your message", text }, "[inbox] contact");
}

/** Confirmation to the partnership submitter (OPS-501 subject). No admin links; never throws. */
export async function confirmPartnership(input: PartnershipInput): Promise<void> {
  const text = [
    `Hi ${firstName(input.name)},`, "",
    "Thanks for writing about a partnership with The Women's Collective. We've got your inquiry and will be in touch.", "",
    confirmFooter("partnerships form"),
  ].join("\n");
  await confirmSubmitter({ to: input.email, subject: "Thanks for reaching out about a partnership", text }, "[inbox] partnership");
}

/** True when the hidden honeypot field has anything in it: a bot, so pretend it worked. */
const isBot = (input: Record<string, unknown>) => input.honeypot !== undefined && input.honeypot !== "" && input.honeypot !== null;

/**
 * Checks, stores, then emails every admin and a short confirmation to the sender. Stored is success: a failed or
 * unconfigured email never loses the message, which waits in the /admin inbox. A honeypot hit returns before
 * anything is stored or sent.
 */
export async function receiveMessage({ db }: Ctx, kind: InboxKind, input: unknown): Promise<void> {
  if (!isObject(input)) throw bad("message");
  if (isBot(input)) return;
  if (kind === "contact") {
    const checked = checkContact(input);
    if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
    const v = checked.value;
    db.prepare("insert into inbox_messages (kind, name, email, topic, message) values ('contact', ?, ?, ?, ?)").run(v.name, v.email, v.topic, v.message);
    if (!(await notifyAdmins(db, contactEmail(v)))) console.warn(`[inbox] ${kind} message stored, but no admin email went out`);
    await confirmContact(v);
    return;
  }
  const checked = checkPartnership(input);
  if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
  const v = checked.value;
  db.prepare("insert into inbox_messages (kind, name, email, business, collaboration_type, message) values ('partnership', ?, ?, ?, ?, ?)")
    .run(v.name, v.email, v.business || null, v.collaboration_type, v.message);
  if (!(await notifyAdmins(db, partnershipEmail(v)))) console.warn(`[inbox] ${kind} message stored, but no admin email went out`);
  await confirmPartnership(v);
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
