-- Custom forms (CRM-094, OPS-228, OPS-518): forms made in the CRM, served at /f/<slug> so the apex's /f/* links keep
-- working after cutover. A published form is one row (its questions as JSON, src/features/forms/schema.ts); each answer
-- is one row in custom_form_responses. Anyone may answer an open form (POST /api/forms/<slug> only); only admins read
-- the answers (requireAdmin in src/features/forms/forms.server.ts). Intro, thank-you and closed words are plain text
-- (paragraphs split on blank lines), never HTML.

-- A link name: the old custom_pages.py SLUG_RE ([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?, no "--") and its reserved set,
-- so a form can never take a path the app or the old /f/* pages use (OPS-418).
create table custom_forms (
  -- The CRM's 8-character form id, kept so imported answers and future CRM links still match.
  id text primary key check (length(id) = 8 and id not glob '*[^a-z0-9]*'),
  slug text not null unique check (
    length(slug) between 1 and 40 and slug not glob '*[^a-z0-9-]*' and slug not glob '-*' and slug not glob '*-' and instr(slug, '--') = 0
    and slug not in ('about', 'admin', 'api', 'apply', 'assets', 'contact', 'crm', 'directory', 'editing', 'events', 'fellowship', 'forms', 'f',
      'index', 'join', 'login', 'members', 'message-sent', 'new', 'partnerships', 'partnership', 'privacy', 'review', 'robots', 'sitemap',
      'subscribed', 'terms', 'thanks', 'thank-you', 'newsletter', 'spotlight', 'membership', 'internal', 'static', '404', 'media', 'beacon', 'places')
  ),
  name text not null check (length(name) between 1 and 80 and instr(name, char(10)) = 0 and instr(name, char(13)) = 0),
  intro text not null default '' check (length(intro) <= 4000),
  thanks text not null default '' check (length(thanks) <= 4000),
  closed_message text not null default '' check (length(closed_message) <= 2000),
  questions text not null check (json_valid(questions) and json_type(questions) = 'array' and length(questions) <= 200000),
  version integer not null default 1 check (version >= 1),
  open integer not null default 1 check (open in (0, 1)),
  -- OPS-249: a second answer with the same email (trimmed, any case) is refused and nothing is stored.
  one_per_email integer not null default 0 check (one_per_email in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Names a form used to have (OPS-425): /f/<old> redirects to the current one. One owner per name (OPS-419); a name
-- that is also some form's current slug is shadowed by it (the current slug is looked up first).
create table custom_form_old_slugs (
  slug text primary key check (length(slug) between 1 and 40 and slug not glob '*[^a-z0-9-]*'),
  form_id text not null references custom_forms(id) on delete cascade
);

-- One row per answer (counted from this table, never from text: FIX-IN-REBUILD OPS-525). A form that still has
-- answers cannot be deleted (no cascade), so answers are never lost with their form.
create table custom_form_responses (
  id text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  form_id text not null references custom_forms(id),
  form_version integer not null,
  -- Only the form's own questions, by key: plumbing fields (honeypot, form-*) are never stored (OPS-205).
  answers text not null check (json_valid(answers) and json_type(answers) = 'object' and length(answers) <= 65536),
  -- The first email-type answer, trimmed and lower-cased (the CRM's email_key, OPS-503), for one-per-email.
  email text check (email is null or length(email) <= 254),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index custom_form_responses_form_created on custom_form_responses (form_id, created_at);
create index custom_form_responses_form_email on custom_form_responses (form_id, email) where email is not null;
