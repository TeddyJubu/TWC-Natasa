-- Eve, the admin assistant. A change Eve prepares is a row here until the admin who asked confirms or cancels it;
-- the model can only add a pending row, and only the admin's own signed-in request can run one.
-- No foreign keys, like admin_actions: the record of who decided what outlives the account. The input is cleared once
-- decided, so a member's details don't stay here after her account is deleted.
create table eve_proposals (
  id text primary key,
  actor_id text not null,
  operation text not null check (length(operation) <= 60),
  input text not null default '{}' check (json_valid(input) and length(input) <= 32768),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'cancelled', 'expired')),
  error text check (error is null or length(error) <= 300),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at text not null,
  decided_at text
);
create index eve_proposals_pending on eve_proposals (actor_id, status, created_at);

-- Which admin opened which Eve conversation, so one admin's session id never opens another's.
create table eve_sessions (
  session_id text primary key check (length(session_id) <= 128),
  actor_id text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
