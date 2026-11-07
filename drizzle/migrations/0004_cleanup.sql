-- 0004 — cleanup: a profile's neighborhood can be unset, and an admin's decision on a profile reaches
-- its newest application.

-- ---------- Neighborhood is optional ----------
-- New sign-ups no longer default to Long Island City; the member picks one (or none). The foreign key
-- stays, so a value must still be a known neighborhood. Existing rows keep what they have.
alter table public.profiles
  alter column neighborhood drop default,
  alter column neighborhood drop not null;

-- ---------- Profile decisions reach the application ----------
-- Same as 0003, except the profile update skips a profile already at that status: when the change
-- started on the profile (below), the profile is already there.
create or replace function public.sync_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
    if new.user_id is not null then
      update public.profiles set status = new.status where id = new.user_id and status is distinct from new.status;
    end if;
  else
    new.reviewed_at := old.reviewed_at;
    if new.reviewed_by is not null then
      new.reviewed_by := old.reviewed_by;
    end if;
  end if;
  return new;
end $$;

-- An admin approving or declining a profile directly sets the same status on that user's newest
-- application, whose own trigger then records reviewed_at/reviewed_by. Only for a change made straight
-- on the profile (depth 1): a profile update that an application review or the sign-up link caused
-- must not echo back to the applications. Members and no-JWT writes never reach this (is_admin()), and
-- putting a profile back to pending isn't a review, so it leaves the application's decision.
create function public.sync_profile_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() = 1 and new.status is distinct from old.status and new.status in ('approved', 'declined')
     and public.is_admin() then
    update public.applications set status = new.status
    where id = (select id from public.applications where user_id = new.id order by created_at desc, id desc limit 1)
      and status is distinct from new.status;
  end if;
  return null;
end $$;
revoke execute on function public.sync_profile_status() from public, anon, authenticated;
create trigger profiles_sync_application after update of status on public.profiles
  for each row execute function public.sync_profile_status();
