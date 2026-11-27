// Server-only: membership applications. Anyone may apply (0001 "Anyone applies"): anonymously (unlinked) or
// signed in (linked to herself). Applicants can't arrive pre-reviewed or link to someone else.
import { assertFormOpen } from "@/features/forms-state/forms-state.server";
import { subscribeIfConsented } from "@/server/beehiiv";
import type { Ctx } from "@/server/context.server";
import type { DB } from "@/server/db";
import { appUrl, signupUrl } from "@/server/email";
import { confirmFooter, confirmSubmitter, firstName, notifyAdmins, oneLine } from "@/server/notify";
import { bad, isObject, str } from "@/server/validate";
import { AREAS, isSigningDate } from "./schema";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";

export type Applicant = { email: string; fullName: string };

export type Stored = Applicant & { answers: Record<string, unknown> };

/** Stores the application; returns what was stored so the caller can act on it (the newsletter opt-in and admin alert). */
export function submitApplication({ db, actor }: Ctx, input: unknown): Stored {
  assertFormOpen(db, "application");
  if (!isObject(input) || !isObject(input.answers)) throw bad("application");
  const stored = { email: str(input.email, "email", 254), fullName: str(input.fullName, "name", 120), answers: input.answers };
  const neighborhood = str(input.neighborhood ?? "", "neighborhood", 60);
  // A page opened before areas existed sends none; any other value must be a real area.
  const { area } = stored.answers;
  if (area !== undefined && !AREAS.some((a) => a.name === area)) throw bad("area");
  if (stored.answers.date !== undefined && !isSigningDate(stored.answers.date)) throw bad("date");
  db.prepare("insert into applications (email, full_name, neighborhood, answers, user_id) values (?, ?, ?, ?, ?)").run(
    stored.email, stored.fullName, neighborhood, JSON.stringify(stored.answers), actor?.id ?? null,
  );
  return stored;
}

/**
 * Tells every admin a new application is waiting: who applied and where to read it. No answers (OPS-384 retired the
 * legacy-key dump). Never throws: the row is already stored.
 */
export async function alertApplication(db: DB, { fullName }: Pick<Stored, "fullName">): Promise<void> {
  try {
    const text = [`${oneLine(fullName)} has sent a membership application.`, "",
      `Read it in the Applications card: ${appUrl()}/admin/applications`].join("\n");
    if (!(await notifyAdmins(db, { subject: oneLine(`New application: ${fullName}`), text }))) console.warn("[application] stored, but no admin email went out");
  } catch {
    console.warn("[application] stored, but the admin alert failed");
  }
}

/**
 * Short thank-you to the applicant after a successful store, with what happens next (the same true facts as
 * /join/thanks: no review time, price or payment) and the Create account link. No admin links. Never throws: the row is
 * already stored.
 */
export async function confirmApplication({ email, fullName }: Stored): Promise<void> {
  const hi = firstName(fullName);
  const text = [
    `Hi ${hi},`, "",
    "Thank you for applying to The Women's Collective. We've received your application.", "",
    "What happens next:",
    "1. The collective reads every application and replies by email.",
    "2. Once you're approved, we send a welcome email, and your member card, events and the members' directory open to you.",
    "3. You can create your login now, with this email address:",
    signupUrl(email), "",
    confirmFooter("membership application"),
  ].join("\n");
  await confirmSubmitter({ to: email, subject: "We got your application", text }, "[application]");
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
export async function optInApplicant(db: DB, { email, fullName, answers }: Stored, quiet = false): Promise<void> {
  await subscribeIfConsented(db, {
    email, name: fullName, consent: newsletterConsent(answers), quiet, utm: { source: "nbwc.site", medium: "membership", campaign: "membership-optin" },
  }).catch(() => console.warn("[newsletter] application stored, but the newsletter opt-in failed"));
}

/**
 * Site applications (never imported ones) that opted in but whose address is not in `newsletter_subscribers`: the
 * opt-ins that went nowhere while the Beehiiv keys were missing. Oldest first, one per address. Read-only; the
 * backfill script sends them through optInApplicant() (quiet: no Beehiiv confirmation), so consent and the
 * already-known check still apply.
 */
export function missedOptIns(db: DB): Stored[] {
  const rows = db.prepare(`select email, full_name, answers from applications
    where json_extract(answers, '$.legacy') is null
      and lower(email) not in (select lower(email) from newsletter_subscribers)
    order by created_at, rowid`).all() as { email: string; full_name: string; answers: string }[];
  const seen = new Set<string>();
  return rows.flatMap(({ email, full_name, answers }) => {
    const parsed = JSON.parse(answers) as Record<string, unknown>;
    const key = email.trim().toLowerCase();
    if (!newsletterConsent(parsed) || seen.has(key)) return [];
    seen.add(key);
    return [{ email, fullName: full_name, answers: parsed }];
  });
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
    const stored = submitApplication(c, input);
    await optInApplicant(c.db, stored);
    await alertApplication(c.db, stored);
    await confirmApplication(stored);
  });
}
