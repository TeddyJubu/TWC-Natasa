-- Editable wording for the built-in public forms (join, review, contact, partnership). The code keeps every
-- default; a row here replaces one default text for one form, keyed by that default (`original`). Deleting the row
-- restores the default. Plain text only. Consent statements, answer choices and notices are never keyed here:
-- they stay fixed in code. Written only by admins (requireAdmin); read by the public pages on every load.

create table form_copy (
  form text not null check (form in ('application', 'review', 'contact', 'partnership')),
  original text not null check (length(original) between 1 and 400),
  value text not null check (length(value) between 1 and 2000),
  updated_by text references "user"(id) on delete set null,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (form, original)
);
