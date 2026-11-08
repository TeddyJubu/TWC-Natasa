// Server-only: who is looking. Self-only, like the old is_member() / is_admin(): nobody can ask about another account.
import type { Ctx } from "@/server/context.server";
import { isAdmin, isMember } from "@/server/guard";

export type SessionUser = { id: string; email: string; name: string };
export type Viewer = { signedIn: boolean; member: boolean; admin: boolean };

export function sessionUser({ db, actor }: Ctx): SessionUser | null {
  if (!actor) return null;
  const user = db.prepare(`select id, email, name from "user" where id = ?`).get(actor.id) as SessionUser | undefined;
  return user ?? null;
}

export function viewer({ db, actor }: Ctx): Viewer {
  if (!actor) return { signedIn: false, member: false, admin: false };
  return { signedIn: true, member: isMember(db, actor.id), admin: isAdmin(db, actor.id) };
}
