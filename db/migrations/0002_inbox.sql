-- The admin inbox (BRIEF decision 9): every /contact message and /partnerships inquiry is stored here as well as
-- emailed to the admins, so nothing is lost when mail fails. Anyone may write (through POST /api/contact and
-- /api/partnerships only); only admins read or archive (requireAdmin in src/features/inbox/inbox.server.ts).
create table inbox_messages (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  kind text not null check (kind in ('contact', 'partnership')),
  name text not null check (length(name) between 1 and 120),
  email text not null check (length(email) <= 254 and email like '%_@_%._%' and email not glob '*[
]*' and email not like '%@%@%'),
  -- contact only: one of the form's topic labels (the label, so a renamed topic never rewrites old messages)
  topic text check (topic is null or length(topic) <= 120),
  -- partnership only
  business text check (business is null or length(business) <= 120),
  collaboration_type text check (collaboration_type is null or collaboration_type in ('host', 'teach', 'supply', 'support', 'other')),
  message text not null check (length(message) between 1 and 5000),
  status text not null default 'new' check (status in ('new', 'archived')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check ((kind = 'contact' and topic is not null and business is null and collaboration_type is null)
      or (kind = 'partnership' and topic is null and collaboration_type is not null))
);
create index inbox_messages_status_created on inbox_messages (status, created_at);
