-- Admin activity (crm-admin-parity phase 3): an append-only record of who approved, declined, noted or moved whom,
-- written by src/features/admin/admin.server.ts in the same call as the change and read on /admin (requireAdmin).
-- No foreign keys on purpose: an append-only row can't be "set null", and a cascade would erase history, so a deleted
-- account or application leaves its row behind and the read shows it as removed. Ids only, never a note's text.
create table admin_actions (
  id integer primary key,
  actor_id text,
  action text not null check (action in ('approved', 'declined', 'pending', 'note_added', 'note_deleted', 'neighborhood')),
  application_id text,
  member_id text,
  detail text not null default '' check (length(detail) <= 200),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check ((application_id is null) <> (member_id is null))
);

create trigger admin_actions_no_update before update on admin_actions
begin
  select raise(abort, 'admin_actions is append-only');
end;

create trigger admin_actions_no_delete before delete on admin_actions
begin
  select raise(abort, 'admin_actions is append-only');
end;
