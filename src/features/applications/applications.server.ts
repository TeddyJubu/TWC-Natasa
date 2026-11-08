// Server-only: membership applications. Anyone may apply (0001 "Anyone applies"): anonymously (unlinked) or
// signed in (linked to herself). Applicants can't arrive pre-reviewed or link to someone else.
import type { Ctx } from "@/server/context.server";
import { bad, isObject, str } from "@/server/validate";
import { checkSize, clientIp, HttpError, respond } from "@/server/request";

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

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
// ponytail: in-memory, per process — the server is one process. Restarting it resets the counts; move this to
// SQLite (or Caddy) if it ever runs as several processes.
const recent = new Map<string, number[]>();

/** True while `ip` has sent fewer than 5 applications in the last 10 minutes (and counts this one). */
function allow(ip: string, now = Date.now()): boolean {
  const kept = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (kept.length >= LIMIT) {
    recent.set(ip, kept);
    return false;
  }
  recent.set(ip, [...kept, now]);
  return true;
}

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
    submitApplication(c, input);
  });
}
