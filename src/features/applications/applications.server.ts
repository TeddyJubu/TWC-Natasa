// Server-only: membership applications. Anyone may apply (0001 "Anyone applies"): anonymously (unlinked) or
// signed in (linked to herself). Applicants can't arrive pre-reviewed or link to someone else.
import type { Ctx } from "@/server/context.server";
import { bad, isObject, str } from "@/server/validate";

export type Applicant = { email: string; fullName: string };

export function submitApplication({ db, actor }: Ctx, input: unknown): void {
  if (!isObject(input) || !isObject(input.answers)) throw bad("application");
  db.prepare("insert into applications (email, full_name, neighborhood, answers, user_id) values (?, ?, ?, ?, ?)").run(
    str(input.email, "email", 254),
    str(input.fullName, "name", 120),
    str(input.neighborhood ?? "", "neighborhood", 60),
    JSON.stringify(input.answers),
    actor?.id ?? null,
  );
}

/** The signed-in applicant's name and email for prefilling /join; null when signed out. */
export function applicant({ db, actor }: Ctx): Applicant | null {
  if (!actor) return null;
  const row = db.prepare(`select u.email, u.name, p.full_name from "user" u left join profiles p on p.id = u.id where u.id = ?`)
    .get(actor.id) as { email: string; name: string; full_name: string | null } | undefined;
  if (!row) return null;
  return { email: row.email, fullName: (row.name.trim() || row.full_name || "").trim() };
}
