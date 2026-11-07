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
  ('avatars', '00000000-0000-4000-8000-00000000000c/avatar-1.jpg');

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
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000c/%') = 1, 'pending member sees own portrait');
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000b/%') = 0, 'pending member cannot see member portraits');
reset role;

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
reset role;

-- A second member hides herself: her earlier portraits disappear for other members.
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-4000-8000-00000000000e', 'hidden@x.test', now());
update profiles set status = 'approved', directory_visible = false where id = '00000000-0000-4000-8000-00000000000e';
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-4000-8000-00000000000e/avatar-old.jpg');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-4000-8000-00000000000e/%') = 0, 'hidden member''s old portraits are hidden');
reset role;

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
reset role;

-- Deleting a login removes the member everywhere.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.ok(not exists (select 1 from profiles where id = '00000000-0000-4000-8000-00000000000b'), 'deleted user leaves the directory');
