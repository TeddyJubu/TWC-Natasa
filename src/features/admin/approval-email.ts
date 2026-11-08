// The approval welcome email: a server function (secrets stay on the server) plus the client call /admin makes.
import { createServerFn } from "@tanstack/react-start";
import type { ApprovalEmailResult } from "./approval-email.server";

export const sendApprovalEmailFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const { applicationId } = (input ?? {}) as Record<string, unknown>;
    if (typeof applicationId !== "string" || !applicationId || applicationId.length > 64) throw new Error("Invalid input");
    return { applicationId };
  })
  // Dynamic imports: the handler (and its secrets) is stripped from the client bundle.
  .handler(async ({ data }) => {
    const [{ serve }, { approvalEmail }] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => approvalEmail(c, data.applicationId));
  });

/** What /admin shows after an approval. */
export type ApprovalNotice = { sent: true } | { sent: false; reason: string };

const REASONS: Record<Exclude<ApprovalEmailResult, { sent: true }>["reason"], string> = {
  "not-approved": "the application isn’t approved",
  "not-configured": "email isn’t set up",
  "send-failed": "sending failed",
};

/** Emails the applicant of an approved application as the signed-in admin. Never throws: the approval already stands. */
export async function emailApproval(applicationId: string): Promise<ApprovalNotice> {
  try {
    const result = await sendApprovalEmailFn({ data: { applicationId } });
    return result.sent ? result : { sent: false, reason: REASONS[result.reason] };
  } catch {
    return { sent: false, reason: "sending failed" };
  }
}
