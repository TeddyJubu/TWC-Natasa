// Server-only: membership applications. Anyone may apply (0001 "Anyone applies"): anonymously (unlinked) or
// signed in (linked to herself). Applicants can't arrive pre-reviewed or link to someone else.
import { subscribeIfConsented } from "@/server/beehiiv";
import type { Ctx } from "@/server/context.server";
import type { DB } from "@/server/db";
import { bad, isObject, str } from "@/server/validate";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";

export type Applicant = { email: string; fullName: string };

export type Stored = Applicant & { answers: Record<string, unknown> };

/** Stores the application; returns what was stored so the caller can act on it (the newsletter opt-in). */
export function submitApplication({ db, actor }: Ctx, input: unknown): Stored {
  if (!isObject(input) || !isObject(input.answers)) throw bad("application");
  const stored = { email: str(input.email, "email", 254), fullName: str(input.fullName, "name", 120), answers: input.answers };
  db.prepare("insert into applications (email, full_name, neighborhood, answers, user_id) values (?, ?, ?, ?, ?)").run(
    stored.email, stored.fullName, str(input.neighborhood ?? "", "neighborhood", 60), JSON.stringify(stored.answers), actor?.id ?? null,
  );
  return stored;
}

/**
 * Did she explicitly opt in to email? Both must hold (OPS-118/357, CRM-182): she asked for the newsletter AND ticked the
 * email-consent box. The form's shape is { newsletter: { subscribe: true, emailConsent: true } }; imported legacy
 * answers use `newsletter: "yes"` + `email_subscription_consent: "yes"`. Anything else — "no", missing, half — is no.
 */
export function newsletterConsent(answers: Record<string, unknown>): boolean {
  const n = answers.newsletter;
  if (isObject(n)) return n.subscribe === true && n.emailConsent === true;
  return n === "yes" && answers.email_subscription_consent === "yes";
}

/** After the application is stored: the opt-in goes to Beehiiv only with consent. A failure never touches the application. */
export async function optInApplicant(db: DB, { email, fullName, answers }: Stored): Promise<void> {
  await subscribeIfConsented(db, {
    email, name: fullName, consent: newsletterConsent(answers), utm: { source: "nbwc.site", medium: "membership", campaign: "membership-optin" },
  }).catch(() => console.warn("[newsletter] application stored, but the newsletter opt-in failed"));
}

/** The signed-in applicant's name and email for prefilling /join; null when signed out. */
export function applicant({ db, actor }: Ctx): Applicant | null {
  if (!actor) return null;
  const row = db.prepare(`select u.email, u.name, p.full_name from "user" u left join profiles p on p.id = u.id where u.id = ?`)
    .get(actor.id) as { email: string; name: string; full_name: string | null } | undefined;
  if (!row) return null;
  return { email: row.email, fullName: (row.name.trim() || row.full_name || "").trim() };
}

/** 5 applications per client IP per 10 minutes. */
const allow = rateLimit(5, 10 * 60 * 1000);

/** POST /api/applications (JSON, ≤ 64 KB): size and the per-IP limit are checked before the body is read. */
export function submitApplicationRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, 64 * 1024);
    if (!allow(clientIp(request.headers))) throw new HttpError("Too many applications from here. Please try again later.", 429);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw bad("application");
    }
    await optInApplicant(c.db, submitApplication(c, input));
  });
}
