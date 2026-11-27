// The email-only newsletter sign-up: its shape and the one check both NewsletterSignup (inline errors) and the
// server (POST /api/newsletter; defence in depth) run. Browser-safe: no server imports.

/** Same length and rule as `newsletter_subscribers.email` (migration 0004) and subscribeIfConsented(). */
export const EMAIL_MAX = 254;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SignupInput = { email: string; consent: true };
/** What the form posts: the checked sign-up plus the honeypot field (empty for people). */
export type SignupRequest = SignupInput & { honeypot: string };
export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

export const SIGNUP_ERRORS = {
  email: "Please give us your email.",
  emailShape: "Please check your email: it should look like name@example.com.",
  consent: "Please tick the box so we can send you the letter.",
} as const;

/** Trims and checks one sign-up. Consent must be exactly `true` (a JSON tick), never "on", "yes" or 1. */
export function checkSignup(input: Record<string, unknown>): { value: SignupInput } | { errors: SignupErrors } {
  const errors: SignupErrors = {};
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!email) errors.email = SIGNUP_ERRORS.email;
  else if (email.length > EMAIL_MAX || !EMAIL.test(email)) errors.email = SIGNUP_ERRORS.emailShape;
  if (input.consent !== true) errors.consent = SIGNUP_ERRORS.consent;
  return Object.keys(errors).length ? { errors } : { value: { email, consent: true } };
}
