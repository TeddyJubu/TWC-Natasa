// Server-only: the one way the app sends email (verification, password reset, approval welcome), through the
// Cloudflare Email Sending API. Without CF_EMAIL_ACCOUNT_ID / CF_EMAIL_API_TOKEN nothing is sent: in development
// the email (and its link) is printed to the server console instead; in production it is simply not-configured.

export type Email = { to: string; subject: string; text: string };
/** Fixed codes, never upstream text, so no secret or provider message reaches a browser. */
export type EmailResult = { sent: true } | { sent: false; reason: "not-configured" | "send-failed" };

const env = (name: string) => process.env[name] || undefined;
// Read by name at runtime: the bundler must not inline the build's NODE_ENV.
const isProduction = () => env("NODE_ENV") === "production";

/** The public origin for links in emails (server env APP_URL), without a trailing slash. */
export const appUrl = () => (env("APP_URL") ?? "http://localhost:8080").replace(/\/+$/, "");

export async function sendEmail({ to, subject, text }: Email): Promise<EmailResult> {
  const accountId = env("CF_EMAIL_ACCOUNT_ID");
  const token = env("CF_EMAIL_API_TOKEN");
  if (!accountId || !token) {
    if (!isProduction()) console.info(`[email] not sent (Cloudflare email isn't set up)\nTo: ${to}\nSubject: ${subject}\n\n${text}`);
    return { sent: false, reason: "not-configured" };
  }
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("EMAIL_FROM") ?? "info@thewomenscollective.club", to: [to], subject, text }),
    });
    const result = (await response.json().catch(() => null)) as { success?: unknown } | null;
    return result?.success === true ? { sent: true } : { sent: false, reason: "send-failed" };
  } catch {
    return { sent: false, reason: "send-failed" };
  }
}
