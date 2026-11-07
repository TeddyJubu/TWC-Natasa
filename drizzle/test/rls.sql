-- Policy checks for the members-only model. Each `ok()` raises on failure; run via drizzle/test/run.sh.
\set ON_ERROR_STOP on
\o /dev/null
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;
grant execute on function pg_temp.ok(boolean, text) to anon, authenticated;

-- Fixtures (as superuser): admin, approved member, pending member.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000000a', 'admin@x.test',   now()),
  ('00000000-0000-4000-8000-00000000000b', 'member@x.test',  now()),
  ('00000000-0000-4000-8000-00000000000c', 'pending@x.test', now());
insert into user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000000a', 'admin');
update profiles set status = 'approved', directory_visible = true, full_name = 'Bea'
  where id = '00000000-0000-4000-8000-00000000000b';
insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-4000-8000-00000000000b/avatar-1.jpg'),
  ('avatars', '00000000-0000-4000-8000-00000000000c/avatar-1.jpg'),
  ('avatars', '00000000-0000-4000-8000-00000000000c/avatar-old.jpg');

-- Anonymous visitor
set role anon;
select pg_temp.ok(not has_function_privilege('public.public_directory()', 'execute'), 'anon cannot read the directory');
select pg_temp.ok((select count(*) from neighborhoods) = 7, 'anon can read neighborhoods');
insert into applications (email, full_name) values ('new@x.test', 'New Applicant');
select pg_temp.ok(true, 'anon can submit an application');
do $$ begin
  insert into applications (email, full_name, user_id) values ('x@x.test', 'X', '00000000-0000-4000-8000-00000000000b');
  raise exception 'FAIL: anon linked an application to someone';
exception when insufficient_privilege then raise notice 'ok  anon cannot link an application to a user';
end $$;
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'avatars') = 0, 'anon sees no portraits');
reset role;

select id as event_id from events order by starts_at limit 1 \gset
set test.event_id = :'event_id';

-- Pending member
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000c';
select pg_temp.ok(not has_function_privilege('public.has_role(uuid, public.app_role)', 'execute'), 'has_role is not callable');
select pg_temp.ok((select count(*) from public_directory()) = 0, 'pending member sees an empty directory');
select pg_temp.ok((select count(*) from events) = 0, 'pending member cannot read events');
update profiles set status = 'approved' where id = auth.uid();
select pg_temp.ok((select status from profiles where id = auth.uid()) = 'pending', 'pending member cannot self-approve');
do $$ begin
  update profiles set avatar_path = '00000000-0000-4000-8000-00000000000b/avatar-1.jpg' where id = auth.uid();
  raise exception 'FAIL: borrowed another member''s portrait';
exception when check_violation then raise notice 'ok  cannot point avatar at another member''s file';
end $$;
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000c/%') = 2, 'pending member sees own portrait');
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000b/%') = 0, 'pending member cannot see member portraits');
-- T3: approval gates RSVPs and bookings, not just reading events.
do $$ begin
  insert into event_rsvps (user_id, event_id) values (auth.uid(), current_setting('test.event_id')::uuid);
  raise exception 'FAIL: pending member RSVPed';
exception when insufficient_privilege then raise notice 'ok  pending member cannot RSVP';
end $$;
do $$ begin
  insert into headshot_bookings (user_id, preferred_date, preferred_time) values (auth.uid(), current_date + 7, 'Morning');
  raise exception 'FAIL: pending member booked a headshot';
exception when insufficient_privilege then raise notice 'ok  pending member cannot book a headshot';
end $$;
-- T4: the old probing helper stays closed too.
select pg_temp.ok(not has_function_privilege('public.is_approved(uuid)', 'execute'), 'is_approved is not callable');
-- T2: owners delete their own portraits (a spare file, so later visibility checks keep theirs) …
delete from storage.objects where name = '00000000-0000-4000-8000-00000000000c/avatar-old.jpg';
-- … and someone who can see a portrait still can't delete it.
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select pg_temp.ok((select count(*) from storage.objects where name = '00000000-0000-4000-8000-00000000000b/avatar-1.jpg') = 1, 'fixture: admin sees the member''s portrait');
delete from storage.objects where name = '00000000-0000-4000-8000-00000000000b/avatar-1.jpg';
reset role;
select pg_temp.ok((select count(*) from storage.objects where name = '00000000-0000-4000-8000-00000000000b/avatar-1.jpg') = 1, 'cannot delete another member''s portrait');
select pg_temp.ok((select count(*) from storage.objects where name = '00000000-0000-4000-8000-00000000000c/avatar-old.jpg') = 0, 'owner can delete her own portrait');
select pg_temp.ok((select public = false and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  from storage.buckets where id = 'avatars'), 'avatars bucket is private, images only, 5 MB');

-- Approved member
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select pg_temp.ok((select count(*) from public_directory()) = 1, 'member sees the directory');
select pg_temp.ok((select count(*) from events) = 4, 'member reads events');
insert into headshot_bookings (user_id, preferred_date, preferred_time, status)
  values (auth.uid(), current_date + 7, 'Morning', 'confirmed');
select pg_temp.ok((select status from headshot_bookings where user_id = auth.uid()) = 'requested', 'member cannot self-confirm a booking');
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000b/%') = 1, 'member sees visible member portraits');
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000c/%') = 0, 'member cannot see pending portraits');
select pg_temp.ok((select count(*) from applications) = 0, 'member cannot read others'' applications');
-- T7: card fields are checked in the database, not only in the form.
do $$ begin
  update profiles set website = 'javascript:alert(1)' where id = auth.uid();
  raise exception 'FAIL: saved a non-http website';
exception when check_violation then raise notice 'ok  website must be http(s)';
end $$;
do $$ begin
  update profiles set bio = repeat('x', 401) where id = auth.uid();
  raise exception 'FAIL: saved a 401-character bio';
exception when check_violation then raise notice 'ok  bio is capped at 400 characters';
end $$;
do $$ begin
  update profiles set neighborhood = 'Atlantis' where id = auth.uid();
  raise exception 'FAIL: saved an unknown neighborhood';
exception when foreign_key_violation then raise notice 'ok  neighborhood must be a known one';
end $$;
reset role;

-- A second member hides herself: her earlier portraits disappear for other members.
-- Fixture writes run with no JWT subject, so the admin-only field trigger lets them through.
reset request.jwt.claim.sub;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-4000-8000-00000000000e', 'hidden@x.test', now());
update profiles set status = 'approved', directory_visible = false where id = '00000000-0000-4000-8000-00000000000e';
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-00000000000e') = 'approved', 'fixture: hidden member is approved');
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-4000-8000-00000000000e/avatar-old.jpg');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000e/%') = 0, 'hidden member''s old portraits are hidden');
reset role;

-- ---------- Public profiles (0002) ----------
-- f: approved + listed, turns on her public profile herself. g: pending with the switch on.
reset request.jwt.claim.sub;
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000000f', 'public@x.test', now()),
  ('00000000-0000-4000-8000-000000000010', 'pendingpublic@x.test', now());
update profiles set status = 'approved', directory_visible = true, full_name = 'Pia'
  where id = '00000000-0000-4000-8000-00000000000f';
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-00000000000f') = 'approved', 'fixture: public member is approved');
insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-4000-8000-00000000000f/avatar-1.jpg'),
  ('avatars', '00000000-0000-4000-8000-000000000010/avatar-1.jpg');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000f';
update profiles set public_profile = true where id = auth.uid();
select pg_temp.ok((select public_profile from profiles where id = auth.uid()), 'member can switch on her public profile');
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000010';
update profiles set directory_visible = true, public_profile = true where id = auth.uid();
select pg_temp.ok((select public_profile from profiles where id = auth.uid()), 'pending member can set the switch');
reset role;

select pg_temp.ok(not exists (
  select 1 from pg_proc p, unnest(p.proargnames) a
  where p.oid = 'public.public_profiles()'::regprocedure and a = 'id'), 'public_profiles() exposes no id column');

set role anon;
reset request.jwt.claim.sub;
select pg_temp.ok(has_function_privilege('public.public_profiles()', 'execute'), 'anon can call public_profiles()');
select pg_temp.ok(has_function_privilege('public.is_admin()', 'execute'), 'anon can evaluate the avatar policy helpers');
select pg_temp.ok((select array_agg(full_name) from public_profiles()) = array['Pia'], 'anon sees only public profiles');
select pg_temp.ok((select array_agg(name) from storage.objects where bucket_id = 'avatars')
  = array['00000000-0000-4000-8000-00000000000f/avatar-1.jpg'], 'anon sees only public portraits');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000010';
select pg_temp.ok((select array_agg(full_name) from public_profiles()) = array['Pia'], 'pending member sees public profiles, not herself');
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000f';
update profiles set directory_visible = false where id = auth.uid();
reset role;
set role anon;
reset request.jwt.claim.sub;
select pg_temp.ok((select count(*) from public_profiles()) = 0, 'hiding from the directory leaves the public site');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'avatars') = 0, 'hiding from the directory hides the public portrait');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000f';
update profiles set directory_visible = true, public_profile = false where id = auth.uid();
reset role;
set role anon;
reset request.jwt.claim.sub;
select pg_temp.ok((select count(*) from public_profiles()) = 0, 'switching off public_profile leaves the public site');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'avatars') = 0, 'switching off public_profile hides the portrait');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000f/%') = 1, 'member still sees a listed, non-public portrait');
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000010';
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000f/%') = 0, 'pending member cannot see a listed, non-public portrait');
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-000000000010/%') = 1, 'admin still sees a pending applicant''s portrait');
reset role;
reset request.jwt.claim.sub;

-- Applicant signs up with the anonymous application's email: linked only after confirmation.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000d', 'NEW@x.test');
select pg_temp.ok((select user_id from applications where email = 'new@x.test') is null, 'unconfirmed sign-up does not claim the application');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-00000000000d';
select pg_temp.ok((select user_id from applications where email = 'new@x.test') = '00000000-0000-4000-8000-00000000000d', 'confirmed sign-up claims the application');

-- Admin approves the application → profile approved with catalogue number.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
update applications set status = 'approved' where email = 'new@x.test';
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-00000000000d') = 'approved', 'approving the application approves the profile');
select pg_temp.ok((select catalogue_number from profiles where id = '00000000-0000-4000-8000-00000000000d') is not null, 'approval assigns a catalogue number');
select pg_temp.ok((select reviewed_at from applications where email = 'new@x.test') is not null, 'review is timestamped');
update headshot_bookings set status = 'confirmed';
select pg_temp.ok((select status from headshot_bookings limit 1) = 'confirmed', 'admin can confirm bookings');
insert into neighborhoods (slug, name, color) values ('woodside', 'Woodside', '#3a7d44');
select pg_temp.ok(true, 'admin can add a neighborhood');
-- T6: a member changing a confirmed booking sends it back to "requested".
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
update headshot_bookings set preferred_time = 'Evening' where user_id = auth.uid();
select pg_temp.ok((select status from headshot_bookings where user_id = auth.uid()) = 'requested', 'member changing a confirmed booking resets it to requested');
-- An approved member can RSVP (the control for the pending check), and the RSVP goes with her login below.
insert into event_rsvps (user_id, event_id) values (auth.uid(), current_setting('test.event_id')::uuid);
reset role;

-- Deleting a login removes the member everywhere.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.ok(not exists (select 1 from profiles where id = '00000000-0000-4000-8000-00000000000b'), 'deleted user leaves the directory');
select pg_temp.ok(not exists (select 1 from user_roles where user_id = '00000000-0000-4000-8000-00000000000b')
  and not exists (select 1 from event_rsvps where user_id = '00000000-0000-4000-8000-00000000000b')
  and not exists (select 1 from headshot_bookings where user_id = '00000000-0000-4000-8000-00000000000b'),
  'deleted user''s roles, RSVPs and booking go too');

-- ---------- Admin review (0003) ----------
-- 11: approved before she signs up, confirms later. 12: approved, signs up already confirmed.
-- 13: still pending when she confirms. 14: approved member, 15: pending member (join checks).
reset role;
reset request.jwt.claim.sub;
set role anon;
insert into applications (email, full_name) values
  ('later@x.test', 'Later Applicant'),
  ('instant@x.test', 'Instant Applicant'),
  ('waiting@x.test', 'Waiting Applicant');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
update applications set status = 'approved' where email in ('later@x.test', 'instant@x.test');
reset role;
reset request.jwt.claim.sub;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000011', 'later@x.test');
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-000000000011') = 'pending'
  and (select user_id from applications where email = 'later@x.test') is null,
  'unconfirmed sign-up stays pending despite an approved application');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-000000000011';
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-000000000011') = 'approved',
  'confirming links an approved application and approves the profile');
select pg_temp.ok((select catalogue_number is not null and member_since is not null from profiles
  where id = '00000000-0000-4000-8000-000000000011'), 'approval on confirmation assigns catalogue number and member_since');

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-4000-8000-000000000012', 'Instant@x.test', now());
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-000000000012') = 'approved',
  'already-confirmed sign-up with an approved application is approved');
select pg_temp.ok((select catalogue_number is not null from profiles where id = '00000000-0000-4000-8000-000000000012'),
  'already-confirmed sign-up gets a catalogue number');

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-4000-8000-000000000013', 'waiting@x.test', now());
select pg_temp.ok((select user_id from applications where email = 'waiting@x.test') = '00000000-0000-4000-8000-000000000013',
  'a pending application links on confirmation');
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-000000000013') = 'pending',
  'a linked pending application leaves the profile pending');

select pg_temp.ok((select reviewed_by from applications where email = 'later@x.test') = '00000000-0000-4000-8000-00000000000a',
  'approval records the reviewing admin');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
update applications set reviewed_by = '00000000-0000-4000-8000-00000000000c' where email = 'later@x.test';
select pg_temp.ok((select reviewed_by from applications where email = 'later@x.test') = '00000000-0000-4000-8000-00000000000a',
  'admin cannot rewrite reviewed_by on its own');
reset role;
reset request.jwt.claim.sub;

set role anon;
do $$ begin
  insert into applications (email, full_name, reviewed_by) values ('forged@x.test', 'Forged', '00000000-0000-4000-8000-00000000000a');
  raise exception 'FAIL: anon pre-filled reviewed_by';
exception when insufficient_privilege then raise notice 'ok  anon cannot pre-fill reviewed_by';
end $$;
reset role;

-- Admin UI joins profiles to applications client-side; only admins get rows back.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000014', 'approvedpeer@x.test', now()),
  ('00000000-0000-4000-8000-000000000015', 'pendingpeer@x.test', now());
update profiles set status = 'approved', directory_visible = true where id = '00000000-0000-4000-8000-000000000014';
update profiles set directory_visible = true where id = '00000000-0000-4000-8000-000000000011';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select pg_temp.ok((select array_agg(a.email) from profiles p join applications a on a.user_id = p.id
  where p.id = '00000000-0000-4000-8000-000000000011') = array['later@x.test'], 'admin joins a profile to its application email');
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000014';
select pg_temp.ok((select count(*) from profiles where id = '00000000-0000-4000-8000-000000000011') = 1,
  'fixture: approved member sees the listed applicant''s card');
select pg_temp.ok(not exists (select a.email from profiles p join applications a on a.user_id = p.id
  where p.id = '00000000-0000-4000-8000-000000000011'), 'approved member cannot join to an applicant''s email');
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000015';
select pg_temp.ok((select count(*) from applications where user_id = '00000000-0000-4000-8000-000000000011') = 0,
  'pending member cannot read an applicant''s application');
select pg_temp.ok(not exists (select a.email from profiles p join applications a on a.user_id = p.id
  where p.id = '00000000-0000-4000-8000-000000000011'), 'pending member cannot join to an applicant''s email');
reset role;
reset request.jwt.claim.sub;

-- Review fixes. 16: a second admin who reviews and then deletes her login. 17: declined before sign-up.
-- 18, 19: accounts linked under the old trigger order, still pending (backfill).
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-4000-8000-000000000016', 'reviewer@x.test', now());
insert into user_roles (user_id, role) values ('00000000-0000-4000-8000-000000000016', 'admin');
set role anon;
insert into applications (email, full_name) values
  ('reviewed@x.test', 'Reviewed Applicant'),
  ('forgedreview@x.test', 'Forged Review'),
  ('declined@x.test', 'Declined Applicant');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000016';
update applications set status = 'approved' where email = 'reviewed@x.test';
reset role;
reset request.jwt.claim.sub;
select pg_temp.ok((select reviewed_by from applications where email = 'reviewed@x.test') = '00000000-0000-4000-8000-000000000016',
  'fixture: second admin recorded as reviewer');
delete from auth.users where id = '00000000-0000-4000-8000-000000000016';
select pg_temp.ok((select reviewed_by from applications where email = 'reviewed@x.test') is null,
  'deleting a reviewer''s login nulls reviewed_by');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
update applications set reviewed_at = '2000-01-01 00:00+00' where email = 'later@x.test';
select pg_temp.ok((select reviewed_at from applications where email = 'later@x.test') > '2001-01-01 00:00+00',
  'admin cannot rewrite reviewed_at on its own');
update applications set status = 'declined', reviewed_by = '00000000-0000-4000-8000-00000000000c' where email = 'forgedreview@x.test';
select pg_temp.ok((select reviewed_by from applications where email = 'forgedreview@x.test') = '00000000-0000-4000-8000-00000000000a',
  'a status change records the admin, not a forged reviewed_by');
update applications set status = 'declined' where email = 'declined@x.test';
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000015';
do $$ begin
  insert into applications (email, full_name, user_id, reviewed_by)
    values ('pendingpeer@x.test', 'Pending Peer', auth.uid(), '00000000-0000-4000-8000-00000000000a');
  raise exception 'FAIL: member pre-filled reviewed_by';
exception when insufficient_privilege then raise notice 'ok  authenticated insert cannot pre-fill reviewed_by';
end $$;
reset role;
reset request.jwt.claim.sub;

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-4000-8000-000000000017', 'declined@x.test', now());
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-000000000017') = 'declined',
  'an application declined before sign-up declines the profile on confirmation');

select pg_temp.ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'applications'
  and indexdef like '%lower(email)%'), 'applications are indexed by lower(email)');

-- Superuser fixtures reproduce the old bug: linked applications, profiles left pending.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000018', 'stuckapproved@x.test', now()),
  ('00000000-0000-4000-8000-000000000019', 'stuckdeclined@x.test', now());
insert into applications (email, full_name, user_id, status) values
  ('stuckapproved@x.test', 'Stuck Approved', '00000000-0000-4000-8000-000000000018', 'declined'),
  ('stuckapproved@x.test', 'Stuck Approved', '00000000-0000-4000-8000-000000000018', 'approved'),
  ('stuckdeclined@x.test', 'Stuck Declined', '00000000-0000-4000-8000-000000000019', 'declined');
select pg_temp.ok((select count(*) from profiles where id in ('00000000-0000-4000-8000-000000000018',
  '00000000-0000-4000-8000-000000000019') and status = 'pending') = 2, 'fixture: stuck profiles are pending');
select public.backfill_linked_application_status();
select pg_temp.ok((select status = 'approved' and catalogue_number is not null from profiles
  where id = '00000000-0000-4000-8000-000000000018'), 'backfill approves a pending profile with an approved application');
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-000000000019') = 'declined',
  'backfill declines a pending profile with only a declined application');
select pg_temp.ok((select status from profiles where id = '00000000-0000-4000-8000-000000000013') = 'pending',
  'backfill leaves a profile whose application is still pending');
set role anon;
select pg_temp.ok(not has_function_privilege('public.backfill_linked_application_status()', 'execute'), 'anon cannot run the backfill');
reset role;
set role authenticated;
select pg_temp.ok(not has_function_privilege('public.backfill_linked_application_status()', 'execute'), 'members cannot run the backfill');
reset role;
