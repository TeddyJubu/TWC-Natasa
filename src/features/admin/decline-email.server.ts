// Server-only: a decline the admin chose to send the kind email with. Declining without it stays on the plain paths.
import type { Ctx } from "@/server/context.server";
import { appUrl, sendEmail, type EmailResult } from "@/server/email";
import { requireAdmin } from "@/server/guard";
import { bad, isObject, oneOf, str } from "@/server/validate";
import { reviewApplication, setMemberStatus } from "./admin.server";
import { DECLINE_SUBJECT, declineText } from "./decline-email";

/** Fixed codes, never upstream text. Every one but `already-declined` means the decline itself went through. */
export type DeclineEmailResult =
  | { sent: true }
  | { sent: false; reason: "already-declined" | "no-address" | Exclude<EmailResult, { sent: true }>["reason"] };

type Recipient = { email: string | null; full_name: string };

/** A member's newest application, as the welcome email uses; her account when she has none. */
const memberRecipient = (db: Ctx["db"], id: string) =>
  (db.prepare("select email, full_name from applications where user_id = ? order by created_at desc, id desc limit 1").get(id)
    ?? db.prepare(`select u.email, p.full_name from profiles p left join "user" u on u.id = p.id where p.id = ?`).get(id)) as Recipient | undefined;

/**
 * Declines and sends once. Only a real change sends, so a double click or a replay can't email twice, and undoing then
 * declining again is a new decision. Nothing awaits between the status read and the write, so two requests can't both
 * see the change. The decline is saved before the send: a failed send leaves it standing and is reported.
 */
export async function declineAndEmail(c: Ctx, input: unknown): Promise<DeclineEmailResult> {
  requireAdmin(c.db, c.actor);
  if (!isObject(input)) throw bad("decline");
  const kind = oneOf(input.kind, ["application", "member"] as const, "kind");
  const id = str(input.id, kind, 64);
  const row = c.db.prepare(kind === "application" ? "select status from applications where id = ?" : "select status from profiles where id = ?")
    .get(id) as { status: string } | undefined;
  if (!row) throw bad(kind);
  if (row.status === "declined") return { sent: false, reason: "already-declined" };

  let to: Recipient | undefined;
  if (kind === "application") {
    reviewApplication(c, { id, status: "declined" });
    to = c.db.prepare("select email, full_name from applications where id = ?").get(id) as Recipient | undefined;
  } else {
    setMemberStatus(c, { id, status: "declined" });
    to = memberRecipient(c.db, id);
  }
  if (!to?.email) return { sent: false, reason: "no-address" };
  return sendEmail({ to: to.email, subject: DECLINE_SUBJECT, text: declineText(to.full_name, `${appUrl()}/contact`) })
    .catch((): DeclineEmailResult => ({ sent: false, reason: "send-failed" }));
}
