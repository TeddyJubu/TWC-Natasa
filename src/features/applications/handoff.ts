// The applicant's email, handed from a sent /join to /join/thanks and on to /auth's Create account, so she needn't type
// it again. It travels in the history entry's state, never in the URL (no address in logs, history or a referrer).
// Client-safe: no server imports.

declare module "@tanstack/history" {
  interface HistoryState {
    /** Only ever her own address, typed on /join in this tab. */
    applicantEmail?: string;
  }
}

/** The longest address the application and Better Auth accept. */
const EMAIL_MAX = 254;

/** A prefill for an email field: a non-empty string of at most 254 characters, else nothing. Only ever a field's value. */
export function prefillEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const email = value.trim();
  return email && email.length <= EMAIL_MAX ? email : undefined;
}

/** The address handed on in this history entry, read in the browser after hydration (the server never has it). */
export function readHandoffEmail(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const state: unknown = window.history.state;
  return state && typeof state === "object" ? prefillEmail((state as { applicantEmail?: unknown }).applicantEmail) : undefined;
}
