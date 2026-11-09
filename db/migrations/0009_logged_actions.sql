-- Logged actions (CRM-057 / CRM-058): things done *outside* the app (calls, meetings, headshot invites, emails…),
-- dated YYYY-MM-DD, note ≤ 1,000 chars (`other` needs a note). Belong to one member profile **or** one application
-- (same two-subject pattern as admin_notes / 0006). Soft-remove via removed_at; every create / edit / remove /
-- restore appends to logged_action_events (append-only). Not folded into admin_actions (0007 is in-app decisions only).
create table logged_actions (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  application_id text references applications (id) on delete cascade,
  member_id text references profiles (id) on delete cascade,
  author_id text references "user" (id) on delete set null,
  kind text not null check (kind in ('headshot_invite', 'headshot_booked', 'headshot_done', 'email_sent', 'call', 'meeting', 'other')),
  action_date text not null check (action_date glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note text not null default '' check (length(note) <= 1000),
  removed_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check ((application_id is null) <> (member_id is null))
);
create index logged_actions_application on logged_actions (application_id) where application_id is not null;
create index logged_actions_member on logged_actions (member_id) where member_id is not null;

create table logged_action_events (
  id integer primary key,
  action_id text not null references logged_actions (id) on delete cascade,
  actor_id text,
  event text not null check (event in ('created', 'edited', 'removed', 'restored')),
  kind text not null,
  action_date text not null,
  note text not null default '',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Updates are forbidden; deletes are allowed only so a cascade from logged_actions (application/member gone)
-- can clear the log. Hand deletes of history are not exposed in the admin API.
create trigger logged_action_events_no_update before update on logged_action_events
begin
  select raise(abort, 'logged_action_events is append-only');
end;
