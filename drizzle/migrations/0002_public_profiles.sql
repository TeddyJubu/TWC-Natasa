-- 0002 — opt-in public profiles (ARCHITECTURE.md §2.10, AUDIT-TASKS.md decision 7).
-- A member who is approved AND listed can also switch on `public_profile`; only then do anonymous
-- visitors see her card (via public_profiles()) and her portrait. Hiding from the directory or
-- losing approval takes her off the public site with nothing to clean up.

alter table public.profiles add column public_profile boolean not null default false;

-- Public card fields only — no id, so the catalogue number is the list key.
-- Known ceiling: avatar_path is `<owner uuid>/…` (the client signs it), so a public member's uuid is
-- visible. Acceptable: she opted in, and nothing callable by anon accepts a uuid beyond the helper below.
create function public.public_profiles()
returns table (full_name text, role_title text, business text, neighborhood text, specialty text,
               bio text, looking_for text, website text, avatar_path text, catalogue_number int)
language sql stable security definer set search_path = public as $$
  select full_name, role_title, business, neighborhood, specialty, bio, looking_for, website, avatar_path, catalogue_number
  from public.profiles
  where status = 'approved' and directory_visible and public_profile
  order by catalogue_number
$$;
revoke execute on function public.public_profiles() from public;
grant execute on function public.public_profiles() to anon, authenticated;

-- Policies run as the caller, and anon cannot read profiles (even inside an `or`), so the
-- portrait visibility check goes through one definer helper. It answers only for an avatar folder
-- (the owner's uuid): listed approved owners for members, public ones for everyone. Anon must be able
-- to execute it (policies run as the caller); it reveals no more than listing storage.objects does.
create function public.avatar_folder_visible(_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id::text = _folder and p.status = 'approved' and p.directory_visible
      and (p.public_profile or public.is_member()))
$$;
revoke execute on function public.avatar_folder_visible(text) from public;
grant execute on function public.avatar_folder_visible(text) to anon, authenticated;
-- The policy below also calls is_admin() as anon; don't rely on default privileges for that.
grant execute on function public.is_admin() to anon, authenticated;

-- Same rules as 0001, plus anonymous visitors for public profiles.
drop policy "Avatar read" on storage.objects;
create policy "Avatar read" on storage.objects for select to anon, authenticated using (
  bucket_id = 'avatars' and (
    -- Files live at `<owner uuid>/avatar-<ts>.<ext>`, so foldername[1] is the owner's id.
    auth.uid()::text = (storage.foldername(name))[1]          -- your own, even while pending
    or public.is_admin()                                       -- reviewers see applicants
    -- Approved AND listed owners: visible to members; also to anyone once she is public.
    or public.avatar_folder_visible((storage.foldername(name))[1])
  )
);
