-- Join / review open-close switch (OPS-081, OPS-140): replaces Classic forms_state.json for the two
-- membership forms. Spotlight stays always-on (no row). Missing/broken state means open (seeded open).
-- Admins toggle from /admin (requireAdmin); public pages read on every GET/POST. Closed = 200 with
-- closed words (like custom forms); POSTs are refused and store nothing. Message ≤ 1,000 chars.

create table forms_state (
  kind text primary key check (kind in ('application', 'review')),
  open integer not null default 1 check (open in (0, 1)),
  -- Empty string → public default message when closed (OPS-031).
  message text not null default '' check (length(message) <= 1000),
  updated_by text references "user"(id) on delete set null,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

insert into forms_state (kind) values ('application'), ('review');
