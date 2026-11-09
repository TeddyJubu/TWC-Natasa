-- 0003 — the legacy import (BRIEF decision 10): the old site's members and newsletter list have a home before anyone
-- has a login, and the sign-up triggers link them by email. Nothing here approves anyone on her own say-so:
-- `legacy_members` rows are written only by scripts/import-legacy.ts (an admin running it on the server), and a row
-- is claimed only by an account whose email is *verified*, exactly like applications in 0001.

-- The old record id (`app-<record_id>`, CRM-028) survives next to the new surrogate key (CRM-173): the import is
-- insert-only and re-runnable because this is unique.
alter table applications add column legacy_id text;
create unique index applications_legacy_id on applications (legacy_id) where legacy_id is not null;

-- Approved members from the old intake `members.jsonl` who have not signed up here yet. A profile needs a user
-- row (profiles.id references "user"), so until then the member lives here. `data` keeps the rest of the old row
-- (phone, links, directory choices …) for the admin; none of it is public.
create table legacy_members (
  legacy_id text primary key,                  -- old member_id (usually the application's record_id, OPS-092)
  email text not null check (length(email) <= 254 and email = lower(email) and email like '%_@_%._%' and email not like '%@%@%'),
  full_name text not null default '' check (length(full_name) <= 120),
  business text not null default '' check (length(business) <= 120),
  role_title text not null default '' check (length(role_title) <= 120),
  website text not null default '' check (length(website) <= 200 and (website = '' or lower(substr(website, 1, 7)) = 'http://' or lower(substr(website, 1, 8)) = 'https://')),
  bio text not null default '' check (length(bio) <= 400),
  member_since text,                           -- the old approved_at, kept when the account is approved
  origin text not null default '' check (length(origin) <= 60),
  data text not null default '{}' check (json_valid(data) and json_type(data) = 'object' and length(data) <= 32768),
  user_id text references "user"(id) on delete set null,   -- set when she signs up and verifies the same email
  linked_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index legacy_members_email on legacy_members (email);

-- The newsletter list (CRM-036): Beehiiv-only subscribers plus /subscribe form rows. `consent` is 1/0 when the
-- form recorded an answer and null for the old Beehiiv list, where it was never recorded here — whoever syncs
-- to Beehiiv decides what null means (legacy bug: the old sync ignored consent).
create table newsletter_subscribers (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  legacy_id text unique,                       -- `newsletter-<subscriber_id>` (CRM-028) or `newsletter-<hash>`
  email text not null unique check (length(email) <= 254 and email = lower(email) and email like '%_@_%._%' and email not like '%@%@%'),
  full_name text not null default '' check (length(full_name) <= 120),
  source text not null default 'website' check (source in ('beehiiv', 'website')),
  consent integer check (consent in (0, 1)),
  subscribed_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------- Sign-up: replace the 0001 triggers (never edit an applied migration) ----------
-- Same as before, plus: a verified account that matches unclaimed legacy members (a) fills her blank profile
-- fields from the newest one, (b) takes the old member-since date, (c) becomes approved — the approval was made
-- by an admin in the old CRM, never by the sign-up — and (d) claims the rows. Unverified accounts change nothing.
-- Visibility (directory_visible / public_profile) is never copied: she opts in again from /account.
drop trigger user_created;
drop trigger user_verified;

create trigger user_created after insert on "user"
begin
  insert into profiles (id, full_name) values (new.id, new.name);
  insert into user_roles (user_id, role) values (new.id, 'member');
  update profiles set
    business = coalesce(nullif(business, ''), (select business from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    role_title = coalesce(nullif(role_title, ''), (select role_title from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    website = coalesce(nullif(website, ''), (select website from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    bio = coalesce(nullif(bio, ''), (select bio from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    member_since = coalesce(member_since, (select min(member_since) from legacy_members where user_id is null and email = lower(new.email)))
    where id = new.id and new.emailVerified = 1;
  update profiles set status = case
      when exists (select 1 from legacy_members where user_id is null and email = lower(new.email)) then 'approved'
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'approved') then 'approved'
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'declined') then 'declined'
      else status end
    where id = new.id and status = 'pending' and new.emailVerified = 1;
  update legacy_members set user_id = new.id, linked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where new.emailVerified = 1 and user_id is null and email = lower(new.email);
  update applications set user_id = new.id where new.emailVerified = 1 and user_id is null and lower(email) = lower(new.email);
end;

create trigger user_verified after update of emailVerified on "user"
  when new.emailVerified = 1 and old.emailVerified is not 1
begin
  update profiles set
    business = coalesce(nullif(business, ''), (select business from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    role_title = coalesce(nullif(role_title, ''), (select role_title from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    website = coalesce(nullif(website, ''), (select website from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    bio = coalesce(nullif(bio, ''), (select bio from legacy_members where user_id is null and email = lower(new.email) order by member_since desc, legacy_id limit 1), ''),
    member_since = coalesce(member_since, (select min(member_since) from legacy_members where user_id is null and email = lower(new.email)))
    where id = new.id;
  update profiles set status = case
      when exists (select 1 from legacy_members where user_id is null and email = lower(new.email)) then 'approved'
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'approved') then 'approved'
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'declined') then 'declined'
      else status end
    where id = new.id and status = 'pending';
  update legacy_members set user_id = new.id, linked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where user_id is null and email = lower(new.email);
  update applications set user_id = new.id where user_id is null and lower(email) = lower(new.email);
end;
