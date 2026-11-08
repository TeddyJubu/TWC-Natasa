// The 0003 backfill: a profile still pending whose linked applications were already reviewed takes their outcome
// (approved over declined). Not a server function: run by scripts/import-lovable.ts after an import.
import type { DB } from "./db";

export function backfillLinkedApplicationStatus(db: DB): void {
  db.prepare(
    `update profiles set status = (
       select case when sum(a.status = 'approved') > 0 then 'approved' else 'declined' end
       from applications a where a.user_id = profiles.id)
     where status = 'pending'
       and exists (select 1 from applications a where a.user_id = profiles.id and a.status in ('approved', 'declined'))`,
  ).run();
}
