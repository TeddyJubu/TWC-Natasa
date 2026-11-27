// Server-only: the email-only newsletter sign-up (POST /api/newsletter). Anyone may sign up; the address reaches
// Beehiiv only through subscribeIfConsented(), which records it in `newsletter_subscribers` and never re-subscribes
// an address already there. A new and a known address get the same 204, so the form is no address oracle; a filled
// honeypot gets it too, with nothing stored or sent. Nothing else is stored and no email is sent from here (Beehiiv
// sends its own confirmation).
import { subscribeIfConsented } from "@/server/beehiiv";
import type { Ctx } from "@/server/context.server";
import { AccessError } from "@/server/guard";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";
import { bad, isObject } from "@/server/validate";
import { checkSignup } from "./schema";

const UTM = { source: "nbwc.site", medium: "website", campaign: "newsletter-signup" };
const UNAVAILABLE = "We couldn’t add you just now. Please try again in a little while.";

/** True when the hidden honeypot field has anything in it: a bot, so pretend it worked. */
const isBot = (input: Record<string, unknown>) => input.honeypot !== undefined && input.honeypot !== "" && input.honeypot !== null;

/**
 * Checks the sign-up, then hands it to subscribeIfConsented(). Subscribed and already-known are both success; an
 * unconfigured or failed send is a 503 for every address alike (logged by reason code only, never the address).
 */
export async function signUp({ db }: Ctx, input: unknown): Promise<void> {
  if (!isObject(input)) throw bad("sign-up");
  if (isBot(input)) return;
  const checked = checkSignup(input);
  if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
  const result = await subscribeIfConsented(db, { email: checked.value.email, consent: checked.value.consent, utm: UTM });
  if (result.subscribed || result.reason === "already-known") return;
  if (result.reason === "invalid-email") throw new AccessError("Please check your email: it should look like name@example.com.", 400);
  console.warn(`[newsletter] sign-up not sent: ${result.reason}`);
  throw new HttpError(UNAVAILABLE, 503);
}

/** 5 per client IP per 10 minutes, like the contact form. */
const limit = rateLimit(5, 10 * 60 * 1000);

/** POST /api/newsletter (JSON, ≤ 2 KB): size and the per-IP limit are checked before the body is read. */
export function newsletterRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, 2 * 1024);
    if (!limit(clientIp(request.headers))) throw new HttpError("Too many sign-ups from here. Please try again later.", 429);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw bad("sign-up");
    }
    await signUp(c, input);
  });
}
