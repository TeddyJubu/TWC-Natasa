// Server-only: who is looking. Self-only, like the old is_member() / is_admin(): nobody can ask about another account.
import type { Ctx } from "@/server/context.server";
import { isAdmin, isDeclined, isMember } from "@/server/guard";

export type SessionUser = { id: string; email: string; name: string };
/** `declined` only chooses honest copy; access still comes from `member` and `admin`. */
export type Viewer = { signedIn: boolean; member: boolean; admin: boolean; declined: boolean };

export function sessionUser({ db, actor }: Ctx): SessionUser | null {
  if (!actor) return null;
  const user = db.prepare(`select id, email, name from "user" where id = ?`).get(actor.id) as SessionUser | undefined;
  return user ?? null;
}

export function viewer({ db, actor }: Ctx): Viewer {
  if (!actor) return { signedIn: false, member: false, admin: false, declined: false };
  const member = isMember(db, actor.id);
  const admin = isAdmin(db, actor.id);
  return { signedIn: true, member, admin, declined: !member && !admin && isDeclined(db, actor.id) };
}
