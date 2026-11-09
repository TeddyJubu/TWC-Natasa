-- Personal member links (CRM-082–088, OPS-019–022, OPS-051): an admin mints a single-use link for an approved member;
-- the member opens /review?t=<token> and sends a review that a person then acts on. Only the token's SHA-256 is
-- stored (FIX-IN-REBUILD CRM-171 / OPS-087: the old staging_links.txt kept live URLs); the URL is shown to the admin once.
-- Only admins mint, list or revoke; the token holder reads her own prefill and sends one review
-- (src/features/member-links/member-links.server.ts).
create table member_links (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  member_id text not null references profiles(id) on delete cascade,
  -- 'spotlight' is accepted so the Weekly Spotlight form (OPS-028) can reuse this table without a rebuild; its tokens
  -- never open the review form because every lookup filters on purpose.
  purpose text not null check (purpose in ('review', 'spotlight')),
  token_hash text not null unique check (length(token_hash) = 64 and token_hash not glob '*[^0-9a-f]*'),
  created_by text references "user"(id) on delete set null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Revoking (or minting a newer link of the same purpose) sets expires_at to now, as the old intake did.
  expires_at text not null,
  used_at text
);
create index member_links_member on member_links (member_id, purpose, created_at);

-- One answer per link (link_id unique): the member's own review. It never changes her profile; status is the admin's
-- to-do flag ('new' until a person has handled it).
create table member_reviews (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  link_id text not null unique references member_links(id) on delete cascade,
  member_id text not null references profiles(id) on delete cascade,
  answers text not null check (json_valid(answers) and json_type(answers) = 'object' and length(answers) <= 32768),
  form_version integer not null default 1,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index member_reviews_status_created on member_reviews (status, created_at);
