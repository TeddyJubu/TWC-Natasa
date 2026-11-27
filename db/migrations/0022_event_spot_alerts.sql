-- One "a spot opened" alert per full event with a waitlist: a row means the admins were told for this opening. It is
-- deleted when someone joins the waitlist (which only happens while the event is full), so the next opening alerts again.
create table event_spot_alerts (
  event_uid text primary key check (length(event_uid) between 1 and 64),
  sent_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
