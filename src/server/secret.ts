/** BETTER_AUTH_SECRET, or a startup error: it signs every session and token, so a missing or short one is fatal. */
export function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters (generate one with `openssl rand -base64 32`).");
  }
  return secret;
}

type Env = Record<string, string | undefined>;

/**
 * In production (NODE_ENV=production): a startup error unless APP_URL is an https:// origin, since Better Auth
 * trusts only that origin and every email link uses it (the localhost fallback would fail every sign-in), and one
 * warning when Cloudflare email isn't set up, since then no verification email goes out and nobody can finish
 * signing up. Outside production it does nothing.
 */
export function checkProductionEnv(env: Env = process.env, warn: (message: string) => void = console.warn): void {
  if (env.NODE_ENV !== "production") return;
  let url: URL | null = null;
  try {
    url = new URL(env.APP_URL ?? "");
  } catch {
    url = null;
  }
  if (url?.protocol !== "https:") {
    throw new Error("APP_URL must be the site's https:// origin in production (e.g. https://thewomenscollective.club).");
  }
  if (!env.CF_EMAIL_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN) {
    warn("[email] CF_EMAIL_ACCOUNT_ID / CF_EMAIL_API_TOKEN aren't set: no email is sent, so nobody can confirm a new account.");
  }
}
