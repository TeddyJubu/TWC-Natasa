-- 0001 — members-only directory, approval enforced in the database, neighborhoods as content,
-- membership applications, and admin review support. See AUDIT-TASKS.md (decisions 1–6).
-- Constraints on existing tables are NOT VALID: they bind every new write without failing on old rows.

-- ---------- Self-only role helpers ----------
-- These answer only for the caller, so nobody can probe another user's role or approval status.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') $$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved') $$;

-- ---------- Neighborhoods as content ----------
create table public.neighborhoods (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (char_length(name) between 1 and 60),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,                -- object in the public `neighborhood-logos` bucket; null = bundled logo for the original seven
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.neighborhoods to anon, authenticated;
grant insert, update, delete on public.neighborhoods to authenticated;
grant all on public.neighborhoods to service_role;
alter table public.neighborhoods enable row level security;
create policy "Anyone reads neighborhoods" on public.neighborhoods for select to anon, authenticated using (true);
create policy "Admins manage neighborhoods" on public.neighborhoods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.neighborhoods (slug, name, color, sort_order) values
  ('long-island-city', 'Long Island City', '#2f9dff', 1),
  ('astoria',          'Astoria',          '#ff9a1f', 2),
  ('sunnyside',        'Sunnyside',        '#9b64ff', 3),
  ('jackson-heights',  'Jackson Heights',  '#ff4d9e', 4),
  ('elmhurst',         'Elmhurst',         '#12d9bd', 5),
  ('forest-hills',     'Forest Hills',     '#5fd35f', 6),
  ('rego-park',        'Rego Park',        '#ff4438', 7)
on conflict do nothing;

-- Renaming a neighborhood cascades; deleting one in use is blocked (set active = false instead).
alter table public.events
  add constraint events_neighborhood_fkey foreign key (neighborhood) references public.neighborhoods(name) on update cascade not valid;

-- ---------- Profiles: integrity + account deletion ----------
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade not valid,
  add constraint profiles_neighborhood_fkey foreign key (neighborhood) references public.neighborhoods(name) on update cascade not valid,
  add constraint profiles_lengths check (
    char_length(full_name) <= 120 and char_length(role_title) <= 120 and char_length(business) <= 120
    and char_length(specialty) <= 80 and char_length(bio) <= 400 and char_length(looking_for) <= 160
    and char_length(website) <= 200) not valid,
  add constraint profiles_website_check check (website = '' or website ~* '^https?://') not valid,
  -- A member can only point her card at a file in her own avatar folder.
  add constraint profiles_avatar_path_check check (avatar_path is null or avatar_path like id::text || '/%') not valid;

alter table public.user_roles
  add constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.event_rsvps
  add constraint event_rsvps_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.headshot_bookings
  add constraint headshot_bookings_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade not valid;

-- Recreate profile policies on the self-only helpers.
drop policy "Approved members see visible members" on public.profiles;
create policy "Members see visible members" on public.profiles for select to authenticated
  using (status = 'approved' and directory_visible and public.is_member());
drop policy "Admins read all" on public.profiles;
create policy "Admins read all" on public.profiles for select to authenticated using (public.is_admin());
drop policy "Admins update" on public.profiles;
create policy "Admins update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Approval enforced for gatherings ----------
drop policy "Members read events" on public.events;
create policy "Members read events" on public.events for select to authenticated
  using (public.is_member() or public.is_admin());

drop policy "Own rsvps" on public.event_rsvps;
create policy "Own rsvps" on public.event_rsvps for all to authenticated
  using (auth.uid() = user_id and public.is_member())
  with check (auth.uid() = user_id and public.is_member());

drop policy "Own booking" on public.headshot_bookings;
create policy "Own booking" on public.headshot_bookings for all to authenticated
  using (auth.uid() = user_id and public.is_member())
  with check (auth.uid() = user_id and public.is_member());
create policy "Admins manage bookings" on public.headshot_bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Members can't confirm their own session: any member insert or change goes back to "requested".
alter table public.headshot_bookings
  add constraint headshot_bookings_status_check check (status in ('requested', 'confirmed', 'declined')) not valid;
create or replace function public.protect_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'requested';
  end if;
  return new;
end $$;
create trigger headshot_bookings_protect before insert or update on public.headshot_bookings
  for each row execute function public.protect_booking_status();

-- ---------- Storage ----------
-- Avatars: private bucket, images only, 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy "Avatar read" on storage.objects;
create policy "Avatar read" on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (
    -- Files live at `<owner uuid>/avatar-<ts>.<ext>`, so foldername[1] is the owner's id.
    auth.uid()::text = (storage.foldername(name))[1]          -- your own, even while pending
    or public.is_admin()                                       -- reviewers see applicants
    -- Other approved members, only while the owner is approved AND listed: hiding from the
    -- directory hides every portrait she ever uploaded (decision 2026-11-07).
    or (public.is_member() and exists (
          select 1 from public.profiles p
          where p.id::text = (storage.foldername(name))[1] and p.status = 'approved' and p.directory_visible))
  )
);
create policy "Avatar own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Neighborhood logos: public brand assets, admins upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('neighborhood-logos', 'neighborhood-logos', true, 2097152, array['image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "Admins manage neighborhood logos" on storage.objects for all to authenticated
  using (bucket_id = 'neighborhood-logos' and public.is_admin())
  with check (bucket_id = 'neighborhood-logos' and public.is_admin());

-- ---------- Directory: members only ----------
drop function public.public_directory();
create function public.public_directory()
returns table (id uuid, full_name text, role_title text, business text, neighborhood text, specialty text,
               bio text, looking_for text, website text, avatar_path text, catalogue_number int)
language sql stable security definer set search_path = public as $$
  select id, full_name, role_title, business, neighborhood, specialty, bio, looking_for, website, avatar_path, catalogue_number
  from public.profiles
  where status = 'approved' and directory_visible and (public.is_member() or public.is_admin())
  order by catalogue_number
$$;
revoke execute on function public.public_directory() from public, anon;
grant execute on function public.public_directory() to authenticated;

-- ---------- Membership applications ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (char_length(full_name) between 1 and 120),
  neighborhood text not null default '' check (char_length(neighborhood) <= 60), -- free text: applicants may live outside the current list
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 32768),
  status public.membership_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant insert on public.applications to anon, authenticated;
grant select, update on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
-- Anonymous applicants can only insert unlinked rows (auth.uid() is null for anon); members only link to themselves.
-- Insert without `.select()` on the client: anon has no read access.
create policy "Anyone applies" on public.applications for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and (user_id is null or user_id = auth.uid()));
create policy "Own applications" on public.applications for select to authenticated using (user_id = auth.uid());
create policy "Admins read applications" on public.applications for select to authenticated using (public.is_admin());
create policy "Admins review applications" on public.applications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Link anonymous applications to an account only once its email is confirmed,
-- so nobody can claim someone else's answers by signing up with their address.
create or replace function public.link_applications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    update public.applications set user_id = new.id
    where user_id is null and lower(email) = lower(new.email);
  end if;
  return new;
end $$;
create trigger on_auth_user_confirmed after insert or update of email_confirmed_at on auth.users
  for each row execute function public.link_applications();

-- Reviewing an application updates the linked profile in the same step.
create or replace function public.sync_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    if new.user_id is not null then
      update public.profiles set status = new.status where id = new.user_id;
    end if;
  end if;
  return new;
end $$;
create trigger applications_review before update on public.applications
  for each row execute function public.sync_application_status();

-- ---------- Close the probing helpers ----------
-- Every policy now uses is_admin()/is_member(); has_role/is_approved remain only for internal callers.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.is_approved(uuid) from public, anon, authenticated;
