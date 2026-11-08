// The approval welcome email: a server function (secrets stay on the server) plus the client call /admin makes.
import { createServerFn } from "@tanstack/react-start";
import { getSupabase } from "@/app/supabase";
import type { ApprovalEmailInput, ApprovalEmailResult } from "./approval-email.server";

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 4096;

export const sendApprovalEmailFn = createServerFn({ method: "POST" })
  .validator((input: unknown): ApprovalEmailInput => {
    const { accessToken, applicationId } = (input ?? {}) as Record<string, unknown>;
    if (!isId(accessToken) || !isId(applicationId)) throw new Error("Invalid input");
    return { accessToken, applicationId };
  })
  // Dynamic import: the handler (and its secrets) is stripped from the client bundle.
  .handler(async ({ data }) => (await import("./approval-email.server")).sendApprovalEmail(data));

/** What /admin shows after an approval. */
export type ApprovalNotice = { sent: true } | { sent: false; reason: string };

const REASONS: Record<Exclude<ApprovalEmailResult, { sent: true }>["reason"], string> = {
  "not-admin": "not allowed",
  "not-approved": "the application isn’t approved",
  "not-configured": "email isn’t set up",
  "send-failed": "sending failed",
};

/** Emails the applicant of an approved application as the signed-in admin. Never throws: the approval already stands. */
export async function emailApproval(applicationId: string): Promise<ApprovalNotice> {
  try {
    const { data } = await (await getSupabase()).auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return { sent: false, reason: "not signed in" };
    const result = await sendApprovalEmailFn({ data: { accessToken, applicationId } });
    return result.sent ? result : { sent: false, reason: REASONS[result.reason] };
  } catch {
    return { sent: false, reason: "sending failed" };
  }
}
