// Server-only: sends the approval welcome email through the Cloudflare Email Sending API.
// Loaded from the server function in ./approval-email.ts, never from client code (it reads secrets).
import { createClient } from "@supabase/supabase-js";
import { parseSiteUrl } from "@/app/seo";
import type { Database } from "@/integrations/supabase/types";

export type ApprovalEmailInput = { accessToken: string; applicationId: string };
/** Reasons are fixed codes, never upstream text, so no secret or provider message reaches the browser. */
export type ApprovalEmailResult =
  | { sent: true }
  | { sent: false; reason: "not-admin" | "not-approved" | "not-configured" | "send-failed" };

const env = (name: string) => process.env[name] || undefined;

/**
 * Acts as the calling admin (their bearer token, so RLS and is_admin() decide), then emails the applicant
 * of an approved application. Never sends for declines: the status must be `approved` when it runs.
 */
export async function sendApprovalEmail({ accessToken, applicationId }: ApprovalEmailInput): Promise<ApprovalEmailResult> {
  const supabase = createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL || env("SUPABASE_URL") || "",
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || env("SUPABASE_PUBLISHABLE_KEY") || "",
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );

  const isAdmin = await supabase.rpc("is_admin");
  if (isAdmin.error || isAdmin.data !== true) return { sent: false, reason: "not-admin" };

  const { data: app } = await supabase.from("applications").select("email, full_name, status").eq("id", applicationId).maybeSingle();
  if (app?.status !== "approved") return { sent: false, reason: "not-approved" };

  const accountId = env("CF_EMAIL_ACCOUNT_ID");
  const token = env("CF_EMAIL_API_TOKEN");
  const site = parseSiteUrl(import.meta.env.VITE_SITE_URL || env("VITE_SITE_URL"));
  if (!accountId || !token || !site) return { sent: false, reason: "not-configured" };

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("EMAIL_FROM") ?? "info@thewomenscollective.club",
        to: [app.email],
        subject: "Welcome to The Women’s Collective",
        text: welcomeText(app.full_name, `${site}/auth`),
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: unknown } | null;
    return result?.success === true ? { sent: true } : { sent: false, reason: "send-failed" };
  } catch {
    return { sent: false, reason: "send-failed" };
  }
}

const welcomeText = (name: string, signIn: string) => `Dear ${name},

Your application to The Women’s Collective has been approved. Welcome!

Sign in (or create your account with this email address) to set up your member card, see upcoming gatherings and meet other members:
${signIn}

We’re so glad you’re here.

The Women’s Collective
`;
