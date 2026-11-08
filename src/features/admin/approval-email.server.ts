// Server-only: the approval welcome email. Callers check the admin first (admin.server.ts approvalEmail).
import type { DB } from "@/server/db";
import { appUrl, sendEmail, type EmailResult } from "@/server/email";

/** Reasons are fixed codes, never upstream text, so no secret or provider message reaches the browser. */
export type ApprovalEmailResult = { sent: true } | { sent: false; reason: "not-approved" | Exclude<EmailResult, { sent: true }>["reason"] };

/** Emails the applicant of an approved application. Never sends for declines: the status must be `approved` now. */
export async function sendApprovalEmail(db: DB, applicationId: string): Promise<ApprovalEmailResult> {
  const app = db.prepare("select email, full_name, status from applications where id = ?").get(applicationId) as
    | { email: string; full_name: string; status: string }
    | undefined;
  if (app?.status !== "approved") return { sent: false, reason: "not-approved" };
  return sendEmail({ to: app.email, subject: "Welcome to The Women’s Collective", text: welcomeText(app.full_name, `${appUrl()}/auth`) });
}

const welcomeText = (name: string, signIn: string) => `Dear ${name},

Your application to The Women’s Collective has been approved. Welcome!

Sign in (or create your account with this email address) to set up your member card, see upcoming gatherings and meet other members:
${signIn}

We’re so glad you’re here.

The Women’s Collective
`;
