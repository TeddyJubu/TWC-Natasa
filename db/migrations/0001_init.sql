-- 0001 — the SQLite equivalent of the end state of the Postgres migrations 0000–0005, plus Better Auth's tables.
-- Who may read or write what (the old RLS) lives in the server functions (src/server/guard.ts); this file keeps
-- the integrity rules: foreign keys, CHECKs for enums and lengths, and the triggers that never depend on who acts.
-- Times are ISO-8601 UTC text (`2026-11-08T12:00:00.000Z`), booleans 0/1, ids text uuids.

-- ---------- Better Auth (core schema; column names are Better Auth's field names) ----------
create table "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  emailVerified integer not null default 0 check (emailVerified in (0, 1)),
  image text,
  createdAt date not null,
  updatedAt date not null
);
create table session (
  id text primary key,
  expiresAt date not null,
  token text not null unique,
  createdAt date not null,
  updatedAt date not null,
  ipAddress text,
  userAgent text,
  userId text not null references "user"(id) on delete cascade
);
create index session_userId on session (userId);
create table account (
  id text primary key,
  accountId text not null,
  providerId text not null,
  userId text not null references "user"(id) on delete cascade,
  accessToken text,
  refreshToken text,
  idToken text,
  accessTokenExpiresAt date,
  refreshTokenExpiresAt date,
  scope text,
  password text,
  createdAt date not null,
  updatedAt date not null
);
create index account_userId on account (userId);
create table verification (
  id text primary key,
  identifier text not null,
  value text not null,
  expiresAt date not null,
  createdAt date not null,
  updatedAt date not null
);
create index verification_identifier on verification (identifier);

-- ---------- Neighborhoods as content ----------
create table neighborhoods (
  slug text primary key check (slug <> '' and slug not glob '*[^a-z0-9-]*' and slug not like '-%' and slug not like '%-' and slug not like '%--%'),
  name text not null unique check (length(name) between 1 and 60),
  color text not null check (length(color) = 7 and color glob '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  logo_path text,               -- file under uploads/neighborhood-logos/; null = bundled logo for the original seven
  sort_order integer not null default 0,
  active integer not null default 1 check (active in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
insert into neighborhoods (slug, name, color, sort_order) values
  ('long-island-city', 'Long Island City', '#2f9dff', 1),
  ('astoria',          'Astoria',          '#ff9a1f', 2),
  ('sunnyside',        'Sunnyside',        '#9b64ff', 3),
  ('jackson-heights',  'Jackson Heights',  '#ff4d9e', 4),
  ('elmhurst',         'Elmhurst',         '#12d9bd', 5),
  ('forest-hills',     'Forest Hills',     '#5fd35f', 6),
  ('rego-park',        'Rego Park',        '#ff4438', 7);

-- ---------- Members ----------
create table user_roles (
  user_id text not null references "user"(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  primary key (user_id, role)
);

create table profiles (
  id text primary key references "user"(id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 120),
  role_title text not null default '' check (length(role_title) <= 120),
  business text not null default '' check (length(business) <= 120),
  -- Optional (0004); renaming a neighborhood cascades, deleting one in use fails (set active = 0 instead).
  neighborhood text references neighborhoods(name) on update cascade,
  specialty text not null default '' check (length(specialty) <= 80),
  bio text not null default '' check (length(bio) <= 400),
  looking_for text not null default '' check (length(looking_for) <= 160),
  website text not null default '' check (length(website) <= 200 and (website = '' or lower(substr(website, 1, 7)) = 'http://' or lower(substr(website, 1, 8)) = 'https://')),
  -- Uploads live in her own folder (`<id>/<kind>-<ts>.<ext>`), so a card can't borrow another member's file.
  avatar_path text check (avatar_path is null or substr(avatar_path, 1, length(id) + 1) = id || '/'),
  business_logo_url text check (business_logo_url is null or substr(business_logo_url, 1, length(id) + 1) = id || '/'),
  directory_visible integer not null default 0 check (directory_visible in (0, 1)),
  public_profile integer not null default 0 check (public_profile in (0, 1)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  catalogue_number integer unique,
  member_since text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The catalogue numbers' high-water mark (Postgres: catalogue_seq start 11), so a number is never reused.
create table catalogue_seq (id integer primary key check (id = 1), last integer not null);
insert into catalogue_seq (id, last) values (1, 10);

-- Approval assigns member_since and the next catalogue number (kept when already set, e.g. by an import).
create trigger profiles_approved after update of status on profiles
  when new.status = 'approved' and old.status <> 'approved'
begin
  update catalogue_seq set last = max(last, coalesce((select max(catalogue_number) from profiles), 0)) + 1
    where new.catalogue_number is null;
  update profiles set
    member_since = coalesce(member_since, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    catalogue_number = coalesce(catalogue_number, (select last from catalogue_seq))
  where id = new.id;
end;

-- Any change stamps updated_at, unless the write set it itself.
create trigger profiles_touch after update on profiles when new.updated_at = old.updated_at
begin
  update profiles set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
end;

-- ---------- Gatherings ----------
create table events (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  title text not null,
  description text not null default '',
  location text not null,
  neighborhood text not null references neighborhoods(name) on update cascade,
  starts_at text not null,
  kind text not null default 'gathering'
);
insert into events (title, description, location, neighborhood, starts_at, kind) values
 ('Waterfront Coffee Introductions', 'Small-table introductions between members who should know each other.', 'Gantry Plaza State Park', 'Long Island City', '2026-10-18T14:00:00.000Z', 'gathering'),
 ('Headshot Session Day', 'Your included professional headshot, styled for your directory profile.', 'Studio on 31st Street', 'Astoria', '2026-10-25T15:00:00.000Z', 'headshots'),
 ('Founders Supper Club', 'A long-table dinner and honest conversation about growing a business.', 'Bistro on 37th Avenue', 'Jackson Heights', '2026-11-06T23:00:00.000Z', 'supper'),
 ('Skill Swap Saturday', 'Bring one thing you know well; leave with three things you did not.', 'Sunnyside Community Room', 'Sunnyside', '2026-11-14T15:00:00.000Z', 'workshop');

create table event_rsvps (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id text not null references "user"(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (user_id, event_id)
);

create table headshot_bookings (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id text not null unique references "user"(id) on delete cascade,
  preferred_date text not null,
  preferred_time text not null,
  notes text not null default '',
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------- Membership applications ----------
create table applications (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id text references "user"(id) on delete set null,
  email text not null check (length(email) <= 254 and email like '%_@_%._%' and email not glob '*[ 	
]*' and email not like '%@%@%'),
  full_name text not null check (length(full_name) between 1 and 120),
  neighborhood text not null default '' check (length(neighborhood) <= 60), -- free text: applicants may live outside the list
  answers text not null default '{}' check (json_valid(answers) and json_type(answers) = 'object' and length(answers) <= 32768),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at text,
  reviewed_by text references "user"(id) on delete set null
);
create index applications_lower_email on applications (lower(email));

-- Reviewing an application timestamps it and gives the linked profile the same status (unless it already has it).
-- reviewed_by is written by the reviewing server function in the same update.
create trigger applications_review after update of status on applications
  when new.status is not old.status
begin
  update applications set reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
  update profiles set status = new.status where id = new.user_id and status is not new.status;
end;

-- ---------- Sign-up ----------
-- Every account gets a profile and the member role. An account whose email is verified claims the applications
-- sent from that address (never before: nobody claims someone else's answers by signing up with their address),
-- and a still-pending profile takes their reviewed outcome, approved over declined (0003).
create trigger user_created after insert on "user"
begin
  insert into profiles (id, full_name) values (new.id, new.name);
  insert into user_roles (user_id, role) values (new.id, 'member');
  update profiles set status = case
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'approved') then 'approved'
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'declined') then 'declined'
      else status end
    where id = new.id and status = 'pending' and new.emailVerified = 1;
  update applications set user_id = new.id where new.emailVerified = 1 and user_id is null and lower(email) = lower(new.email);
end;

create trigger user_verified after update of emailVerified on "user"
  when new.emailVerified = 1 and old.emailVerified is not 1
begin
  update profiles set status = case
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'approved') then 'approved'
      when exists (select 1 from applications where user_id is null and lower(email) = lower(new.email) and status = 'declined') then 'declined'
      else status end
    where id = new.id and status = 'pending';
  update applications set user_id = new.id where user_id is null and lower(email) = lower(new.email);
end;
