// Server-only: open/close for scrapbook /join (application) and /review (OPS-081, OPS-140). Spotlight has no
// switch. Rows live in forms_state (migration 0010); a missing kind is treated as open (OPS-031). Anyone may
// read public state; only admins toggle (requireAdmin). Closed GET = 200 with closed words; closed POST stores
// nothing (HttpError 410, like custom forms).
import type { Ctx } from "@/server/context.server";
import { now, type DB } from "@/server/db";
import { requireAdmin } from "@/server/guard";
import { HttpError } from "@/server/request";
import { bad, isObject, str } from "@/server/validate";
import { CLOSED_DEFAULT, CLOSED_MESSAGE_MAX, type FormKind } from "./constants";

export type { FormKind } from "./constants";
export { CLOSED_DEFAULT, CLOSED_MESSAGE_MAX, CLOSED_TITLE, KIND_LABEL, KINDS } from "./constants";

export type PublicFormState = { kind: FormKind; open: boolean; closed: string | null };
export type AdminFormState = {
  kind: FormKind; open: boolean; message: string; updated_at: string; updated_by: string | null;
};

type Row = { kind: FormKind; open: number; message: string; updated_at: string; updated_by: string | null };

const isKind = (value: unknown): value is FormKind => value === "application" || value === "review";

const kindOf = (input: unknown): FormKind => {
  const kind = isObject(input) ? input.kind : input;
  if (!isKind(kind)) throw bad("form");
  return kind;
};

const row = (db: DB, kind: FormKind): Row | undefined =>
  db.prepare("select kind, open, message, updated_at, updated_by from forms_state where kind = ?").get(kind) as Row | undefined;

/** Closed words for a kind, or null when open / missing (missing = open, OPS-031). */
export function closedMessage(db: DB, kind: FormKind): string | null {
  const found = row(db, kind);
  if (!found || found.open) return null;
  return found.message.trim() || CLOSED_DEFAULT;
}

/** Public read for /join and /review: open + closed words when closed. Missing row = open. */
export function publicFormState({ db }: Ctx, input: unknown): PublicFormState {
  const kind = kindOf(input);
  const closed = closedMessage(db, kind);
  return { kind, open: closed === null, closed };
}

/** Refuse a store when the kind is closed (POST /api/applications, POST /api/review). */
export function assertFormOpen(db: DB, kind: FormKind): void {
  const closed = closedMessage(db, kind);
  if (closed) throw new HttpError(closed, 410);
}

/** Both kinds for the /admin card (requireAdmin). */
export function adminFormsState({ db, actor }: Ctx): AdminFormState[] {
  requireAdmin(db, actor);
  return (db.prepare("select kind, open, message, updated_at, updated_by from forms_state order by kind").all() as Row[])
    .map((r) => ({ kind: r.kind, open: r.open === 1, message: r.message, updated_at: r.updated_at, updated_by: r.updated_by }));
}

/**
 * Open or close application / review (CRM-100 shape for the two membership kinds). Opening with no message keeps
 * the last one; a provided message (≤ 1,000 chars) is stored either way. Empty on close clears to the public default.
 */
export function setMembershipFormOpen({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("form");
  const kind = kindOf(input);
  if (input.open !== true && input.open !== false) throw bad("open");
  const open = input.open;
  const found = row(db, kind);
  if (!found) throw bad("form");
  let message = found.message;
  if (input.message !== undefined) {
    const next = str(input.message, "message", CLOSED_MESSAGE_MAX).trim();
    if (next || !open) message = next;
  }
  db.prepare(`update forms_state set open = ?, message = ?, updated_by = ?, updated_at = ? where kind = ?`)
    .run(open ? 1 : 0, message, me.id, now(), kind);
}
