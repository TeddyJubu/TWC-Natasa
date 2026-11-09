-- Admin notes (CRM-055): a private note an admin leaves on one application or one member profile. Only admins read,
-- add or delete them (requireAdmin in src/features/admin/admin.server.ts); there is no edit (delete and re-add).
-- Exactly one subject per note, each a real foreign key, so a note goes with the row it is about.
create table admin_notes (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  application_id text references applications (id) on delete cascade,
  member_id text references profiles (id) on delete cascade,
  author_id text references "user" (id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check ((application_id is null) <> (member_id is null))
);
create index admin_notes_application on admin_notes (application_id) where application_id is not null;
create index admin_notes_member on admin_notes (member_id) where member_id is not null;
