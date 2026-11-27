-- Waitlists for full Cal events. Cal's community events know only GOING / MAYBE / NOT_GOING, so who is waiting
-- lives here, keyed by the Cal event uid and the email (one place per person per event). A member's row carries her
-- user id and goes with her account; a guest's row has none and is removed by email when that account is deleted.
create table event_waitlist (
  id integer primary key,
  event_uid text not null check (length(event_uid) between 1 and 64),
  email text not null check (length(email) between 3 and 254),
  name text not null check (length(name) between 1 and 120),
  user_id text references "user"(id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (event_uid, email)
);
