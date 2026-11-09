-- Weekly Spotlight answers (CRM-037/083/097, OPS-028/029/049). A member sends them once through a personal
-- `purpose = 'spotlight'` link from member_links (0003): same hashing, expiry and single use as review links.
-- Why not member_reviews: its link_id is required and member_id must be a profile, but the historical answers
-- imported from the old spotlight_answers.jsonl (scripts/import-legacy.ts) have no link and belong to an old member id
-- that may never sign up here. So: one table for both, the old ids kept beside the new ones.
-- Answers never change a profile and nothing here is public; only admins read it (requireAdmin).
create table spotlight_answers (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  -- Sent through a link: one answer per link. Imported: null.
  link_id text unique references member_links(id) on delete cascade,
  -- Her profile when known (always for a link; for an import only when the old member has already claimed her login).
  member_id text references profiles(id) on delete cascade,
  -- Imported rows: the old record_id (insert-only, re-runnable import) and the old member_id.
  legacy_id text unique check (length(legacy_id) <= 80),
  legacy_member_id text check (length(legacy_member_id) <= 80),
  -- What she wrote in section 01, as sent (not her profile).
  full_name text not null check (length(full_name) between 1 and 300),
  business text not null default '' check (length(business) <= 300),
  neighborhood text not null default '' check (length(neighborhood) <= 300),
  -- {<old Google Form column name>: text}, blanks left out (OPS-029, OPS-049).
  answers text not null check (json_valid(answers) and json_type(answers) = 'object' and length(answers) <= 32768),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (link_id is not null or legacy_id is not null)
);
create index spotlight_answers_created on spotlight_answers (created_at);
