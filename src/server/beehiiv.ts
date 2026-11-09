// Server-only: the one way anyone reaches the Beehiiv newsletter list (FIX-IN-REBUILD CRM-182, OPS-450/520/521).
// Applications, the site newsletter form and custom-form boxes all call subscribeIfConsented(), which:
//   1. needs an explicit `consent === true` from the caller (null, "yes", 1, a missing answer: all no);
//   2. never sends an address that is already in `newsletter_subscribers` — the imported Beehiiv list (consent null:
//      "never recorded here") and every earlier opt-in are already on the list or were unsubscribed on purpose, so a
//      replayed row or a restored backup can't re-subscribe anyone (OPS-521);
//   3. asks Beehiiv NOT to reactivate (the old sync's `reactivate_existing: true` re-subscribed people who had left).
// Env names: BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID. Without them nothing is sent and nothing is recorded.
import type { DB } from "./db";

export type Optin = {
  email: string;
  name?: string;
  /** Must be exactly `true`: the person ticked the box. */
  consent: unknown;
  /** Beehiiv's utm fields, e.g. { source: "nbwc.site", medium: "membership", campaign: "membership-optin" }. */
  utm: { source: string; medium: string; campaign: string };
};
export type SubscribeResult =
  | { subscribed: true }
  | { subscribed: false; reason: "no-consent" | "invalid-email" | "already-known" | "not-configured" | "send-failed" };

const env = (name: string) => process.env[name] || undefined;
const KEY = /^[\x20-\x7e]{8,512}$/;
const PUBLICATION = /^[A-Za-z0-9_-]{1,80}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Subscribes `email` to Beehiiv only with explicit consent and only once. The address is claimed in SQLite first
 * (the unique email makes two racing sends one), then sent; a failed send releases the claim so a later opt-in can
 * retry. Fixed reason codes only — no key or upstream text is ever returned or logged.
 */
export async function subscribeIfConsented(db: DB, { email, name = "", consent, utm }: Optin): Promise<SubscribeResult> {
  if (consent !== true) return { subscribed: false, reason: "no-consent" };
  const address = email.trim().toLowerCase();
  if (address.length > 254 || !EMAIL.test(address)) return { subscribed: false, reason: "invalid-email" };
  const key = env("BEEHIIV_API_KEY");
  const publication = env("BEEHIIV_PUBLICATION_ID");
  if (!key || !KEY.test(key) || !publication || !PUBLICATION.test(publication)) return { subscribed: false, reason: "not-configured" };

  const claimed = db.prepare("insert into newsletter_subscribers (email, full_name, source, consent) values (?, ?, 'website', 1) on conflict(email) do nothing")
    .run(address, name.trim().slice(0, 120)).changes;
  if (!claimed) return { subscribed: false, reason: "already-known" };

  let ok = false;
  try {
    const response = await fetch(`https://api.beehiiv.com/v2/publications/${publication}/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: address, reactivate_existing: false, send_welcome_email: true, double_opt_override: "on",
        utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    ok = response.ok;
  } catch {
    // network error or timeout: treated as a failed send below
  }
  if (ok) return { subscribed: true };
  db.prepare("delete from newsletter_subscribers where email = ? and legacy_id is null").run(address);
  return { subscribed: false, reason: "send-failed" };
}
