/** BETTER_AUTH_SECRET, or a startup error: it signs every session and token, so a missing or short one is fatal. */
export function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters (generate one with `openssl rand -base64 32`).");
  }
  return secret;
}
