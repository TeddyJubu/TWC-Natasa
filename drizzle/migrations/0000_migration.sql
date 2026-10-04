create type public.app_role as enum ('admin', 'member');
create type public.membership_status as enum ('pending', 'approved', 'declined');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create sequence public.catalogue_seq start 11;

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  role_title text not null default '',
  business text not null default '',
  neighborhood text not null default 'Long Island City',
  specialty text not null default '',
  bio text not null default '',
  looking_for text not null default '',
  website text not null default '',
  avatar_path text,
  directory_visible boolean not null default false,
  status membership_status not null default 'pending',
  catalogue_number int,
  member_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = _user_id and status = 'approved') $$;

create policy "Own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Approved members see visible members" on public.profiles for select to authenticated
  using (status = 'approved' and directory_visible and public.is_approved(auth.uid()));
create policy "Admins read all" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins update" on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.status := old.status;
    new.catalogue_number := old.catalogue_number;
    new.member_since := old.member_since;
  end if;
  if new.status = 'approved' and old.status <> 'approved' then
    new.member_since := coalesce(new.member_since, now());
    new.catalogue_number := coalesce(new.catalogue_number, nextval('public.catalogue_seq'));
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'member');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.public_directory()
returns table (id uuid, full_name text, role_title text, business text, neighborhood text, specialty text, bio text, looking_for text, avatar_path text, catalogue_number int)
language sql stable security definer set search_path = public as $$
  select id, full_name, role_title, business, neighborhood, specialty, bio, looking_for, avatar_path, catalogue_number
  from public.profiles where status = 'approved' and directory_visible order by catalogue_number
$$;
grant execute on function public.public_directory() to anon, authenticated;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  location text not null,
  neighborhood text not null,
  starts_at timestamptz not null,
  kind text not null default 'gathering'
);
grant select on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "Members read events" on public.events for select to authenticated using (true);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
grant select, insert, delete on public.event_rsvps to authenticated;
grant all on public.event_rsvps to service_role;
alter table public.event_rsvps enable row level security;
create policy "Own rsvps" on public.event_rsvps for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.headshot_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  preferred_date date not null,
  preferred_time text not null,
  notes text not null default '',
  status text not null default 'requested',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.headshot_bookings to authenticated;
grant all on public.headshot_bookings to service_role;
alter table public.headshot_bookings enable row level security;
create policy "Own booking" on public.headshot_bookings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.events (title, description, location, neighborhood, starts_at, kind) values
 ('Waterfront Coffee Introductions', 'Small-table introductions between members who should know each other.', 'Gantry Plaza State Park', 'Long Island City', '2026-10-18 14:00+00', 'gathering'),
 ('Headshot Session Day', 'Your included professional headshot, styled for your directory profile.', 'Studio on 31st Street', 'Astoria', '2026-10-25 15:00+00', 'headshots'),
 ('Founders Supper Club', 'A long-table dinner and honest conversation about growing a business.', 'Bistro on 37th Avenue', 'Jackson Heights', '2026-11-06 23:00+00', 'supper'),
 ('Skill Swap Saturday', 'Bring one thing you know well; leave with three things you did not.', 'Sunnyside Community Room', 'Sunnyside', '2026-11-14 15:00+00', 'workshop');

create policy "Avatar read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "Avatar own upload" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Avatar own update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);