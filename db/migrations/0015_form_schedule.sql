-- Custom forms (0005) get a schedule, a cap and an opt-in confirmation (CRM-101, CRM-141). Each one only narrows when
-- an open form takes answers: `open` stays the admin's switch, and availability() in src/features/forms/forms.server.ts
-- reads all four together. Times are ISO-8601 UTC ('…Z'), so text order is time order; null means no limit.
alter table custom_forms add column opens_at text check (opens_at is null or (length(opens_at) = 24 and opens_at glob '????-??-??T??:??:??.???Z'));
alter table custom_forms add column closes_at text check (closes_at is null or (length(closes_at) = 24 and closes_at glob '????-??-??T??:??:??.???Z'));
-- Answers counted from custom_form_responses, so a deleted answer frees its place.
alter table custom_forms add column max_responses integer check (max_responses is null or max_responses between 1 and 100000);
-- Email the person who answered (the form's first email question) a short "we got your answers". Off by default:
-- a form is often filled in for someone else, and the old CRM sent none unless asked.
alter table custom_forms add column confirm integer not null default 0 check (confirm in (0, 1));
