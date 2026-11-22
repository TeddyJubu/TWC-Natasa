-- One-shot stamp for approval profile draft (prefill-from-application). Once set, blank fields are never
-- re-filled from the application, so a member can clear a value without the next /account load restoring it.
alter table profiles add column application_draft_at text;
