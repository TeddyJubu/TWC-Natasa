// Server-only: what Better Auth's user.deleteUser (POST /api/auth/delete-user, src/server/auth.server.ts) does
// around removing the "user" row. Her profile, roles, sessions, accounts, RSVPs, bookings, member links, reviews,
// Spotlight answers, feed posts, loves and replies go with it through `on delete cascade`; applications only lose
// their user_id there, so they are deleted here, with every one sent from her email.
import { APIError } from "better-auth/api";
import type { DB } from "./db.ts";
import { isAdmin } from "./guard.ts";
import { removeMediaFolder } from "./media.ts";

type DeletedUser = { id: string; email: string };

/** True when she signs in with a password (Google-only accounts have none and need a fresh session instead). */
export const hasPassword = (db: DB, userId: string) =>
  !!db.prepare("select 1 from account where userId = ? and providerId = 'credential' and password is not null").get(userId);

/** Before the row goes: admins can't delete themselves this way; then her applications (by account or email). */
export function beforeAccountDelete(db: DB, user: DeletedUser): void {
  if (isAdmin(db, user.id)) {
    throw new APIError("FORBIDDEN", { code: "ADMIN_CANNOT_DELETE", message: "An admin account can’t be deleted from here." });
  }
  db.prepare("delete from applications where user_id = ? or lower(email) = lower(?)").run(user.id, user.email);
}

/** After the row is gone: her upload folders (portraits and logos, newsfeed photos). */
export function afterAccountDelete(user: DeletedUser): void {
  removeMediaFolder("avatars", user.id);
  removeMediaFolder("feed", user.id);
}
