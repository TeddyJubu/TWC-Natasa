// Server-only: the Weekly Spotlight (OPS-028, migration 0008) behind a `purpose = 'spotlight'` personal link. Minting,
// revoking and link states are member-links.server.ts with `purpose: "spotlight"` (requireAdmin). The token holder —
// no session, the link is the credential — reads her prefill and sends one set of answers; admins read them all.
// A Spotlight token never opens /review and a review token never opens /spotlight: every lookup filters on purpose.
import type { Ctx } from "@/server/context.server";
import { now, tx, type DB } from "@/server/db";
import { appUrl } from "@/server/email";
import { AccessError, requireAdmin } from "@/server/guard";
import { notifyAdmins, oneLine } from "@/server/notify";
import { checkSize, clientIp, HttpError, rateLimit, respond } from "@/server/request";
import { bad, isObject } from "@/server/validate";
import { activeLink, isBot, memberValues } from "./member-links.server";
import { checkSpotlight, INVALID_SPOTLIGHT, type IdentityField } from "./spotlight";

const invalidLink = () => new HttpError(INVALID_SPOTLIGHT, 404);

export type SpotlightPrefill = { firstName: string; values: Record<IdentityField, string> };
export type AdminSpotlight = {
  id: string; full_name: string; business: string; neighborhood: string; answers: Record<string, string>;
  created_at: string; imported: boolean; member_id: string | null;
};

/** Name, business and neighborhood to prefill (MF:1217-1218); null when the token doesn't open the form. */
export function openSpotlight({ db }: Ctx, input: unknown): SpotlightPrefill | null {
  const link = activeLink(db, isObject(input) ? input.token : undefined, "spotlight");
  if (!link) return null;
  const v = memberValues(db, link.member_id);
  const values = { full_name: v.full_name, business: v.business_practice, neighborhood: v.neighborhood_city };
  return { firstName: values.full_name.split(/\s+/)[0] || "there", values };
}

/**
 * Stores her answers and uses the link up in one transaction (the conditional update is the single-use check, as
 * for reviews). Her profile is never touched. Returns the stored row's id, or null for a bot (nothing stored).
 */
export function submitSpotlight({ db }: Ctx, input: unknown): string | null {
  if (!isObject(input)) throw bad("answers");
  if (isBot(input)) return null;
  const link = activeLink(db, input.token, "spotlight");
  if (!link) throw invalidLink();
  const checked = checkSpotlight(input);
  if ("errors" in checked) throw new AccessError(Object.values(checked.errors)[0]!, 400);
  const { full_name, business, neighborhood, answers } = checked.value;
  const at = now();
  return tx(db, () => {
    const used = db.prepare("update member_links set used_at = ? where id = ? and used_at is null and expires_at > ?").run(at, link.id, at).changes;
    if (!used) throw invalidLink();
    const row = db.prepare(`insert into spotlight_answers (link_id, member_id, full_name, business, neighborhood, answers, created_at)
      values (?, ?, ?, ?, ?, ?, ?) returning id`).get(link.id, link.member_id, full_name, business, neighborhood, JSON.stringify(answers), at) as { id: string };
    return row.id;
  });
}

/**
 * Every Spotlight answer, sent and imported, newest first (CRM-037 Spotlight history, CRM-097).
 * ponytail: no paging — a few hundred rows at most; page by created_at if it ever grows past that.
 */
export function adminSpotlights({ db, actor }: Ctx): AdminSpotlight[] {
  requireAdmin(db, actor);
  const rows = db.prepare(`select id, full_name, business, neighborhood, answers, created_at, legacy_id, member_id from spotlight_answers
    order by created_at desc, rowid desc`).all() as (Omit<AdminSpotlight, "answers" | "imported"> & { answers: string; legacy_id: string | null })[];
  return rows.map(({ legacy_id, answers, ...r }) => ({ ...r, imported: legacy_id !== null, answers: JSON.parse(answers) as Record<string, string> }));
}

/**
 * Tells every admin a Spotlight answer is waiting (the stored row, not the form post): who sent it and where to
 * read it. No answer dump. Never throws: the answer is already stored and the link used.
 */
export async function alertSpotlight(db: DB, spotlightId: string): Promise<void> {
  try {
    const r = db.prepare("select full_name from spotlight_answers where id = ?").get(spotlightId) as { full_name: string } | undefined;
    if (!r) return;
    const text = [`${oneLine(r.full_name)} has sent a Weekly Spotlight answer.`, "",
      `Read it in the Spotlight answers card: ${appUrl()}/admin#spotlight`].join("\n");
    if (!(await notifyAdmins(db, { subject: oneLine(`Spotlight answer: ${r.full_name}`), text }))) console.warn("[spotlight] stored, but no admin email went out");
  } catch {
    console.warn("[spotlight] stored, but the admin alert failed");
  }
}

// ponytail: 10 per client IP per 10 minutes, in memory (see rateLimit); a link opens once anyway.
const limit = rateLimit(10, 10 * 60 * 1000);

/** POST /api/spotlight (JSON, ≤ 32 KB, the old intake's cap): size and the per-IP limit are checked before the body is read. */
export function spotlightRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, 32 * 1024);
    if (!limit(clientIp(request.headers))) throw new HttpError("Too many tries from here. Please try again later.", 429);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw bad("answers");
    }
    const id = submitSpotlight(c, input);
    if (id) await alertSpotlight(c.db, id);
  });
}
