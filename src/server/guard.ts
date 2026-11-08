// Who may do what: the access rules the Postgres RLS policies used to enforce. Every server function's domain
// code (the *.server.ts modules) starts with one of requireSession / requireMember / requireAdmin, or takes an
// optional actor where anonymous visitors are allowed. Tests call these with a fixed actor.
import type { DB } from "./db";

/** The signed-in account behind a request, or null for an anonymous visitor. */
export type Actor = { id: string; email: string } | null;
export type SignedIn = NonNullable<Actor>;

/** A refusal the browser may see: a fixed message and an HTTP-ish status, never internals. */
export class AccessError extends Error {
  constructor(message: string, readonly status: 401 | 403 | 400 | 404 = 403) {
    super(message);
    this.name = "AccessError";
  }
}

/** Self-only helpers (the old is_admin() / is_member()): they answer only for the given id. */
export const isAdmin = (db: DB, id: string | undefined) =>
  !!id && !!db.prepare("select 1 from user_roles where user_id = ? and role = 'admin'").get(id);
export const isMember = (db: DB, id: string | undefined) =>
  !!id && !!db.prepare("select 1 from profiles where id = ? and status = 'approved'").get(id);

export function requireSession(actor: Actor): SignedIn {
  if (!actor) throw new AccessError("Please sign in.", 401);
  return actor;
}

/** An approved member; admins pass too (they read and manage everything members can). */
export function requireMember(db: DB, actor: Actor): SignedIn {
  const me = requireSession(actor);
  if (!isMember(db, me.id) && !isAdmin(db, me.id)) throw new AccessError("Members only.");
  return me;
}

export function requireAdmin(db: DB, actor: Actor): SignedIn {
  const me = requireSession(actor);
  if (!isAdmin(db, me.id)) throw new AccessError("Admins only.");
  return me;
}
