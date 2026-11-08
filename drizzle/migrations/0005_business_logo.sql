-- 0005: optional business logo on a member's profile (Owner decision 7).
-- The column holds a storage path in the private `avatars` bucket, in the member's own folder
-- (`<uid>/logo-<ts>.<ext>`), so the existing policies cover it unchanged: "Avatar own upload/update"
-- (0000) and "Avatar own delete" (0001) let only the owner write there, and "Avatar read" (0002,
-- avatar_folder_visible) shows it exactly where her portrait shows. The client signs it like avatar_path.
alter table public.profiles
  add column business_logo_url text,
  -- Like avatar_path: a member can only point her logo at a file in her own folder.
  add constraint profiles_business_logo_url_check check (business_logo_url is null or business_logo_url like id::text || '/%');

-- The directory card dialog shows the logo, so public_directory() returns it (same rules as 0001).
drop function public.public_directory();
create function public.public_directory()
returns table (id uuid, full_name text, role_title text, business text, neighborhood text, specialty text,
               bio text, looking_for text, website text, avatar_path text, catalogue_number int, business_logo_url text)
language sql stable security definer set search_path = public as $$
  select id, full_name, role_title, business, neighborhood, specialty, bio, looking_for, website, avatar_path, catalogue_number, business_logo_url
  from public.profiles
  where status = 'approved' and directory_visible and (public.is_member() or public.is_admin())
  order by catalogue_number
$$;
revoke execute on function public.public_directory() from public, anon;
grant execute on function public.public_directory() to authenticated;
