-- 0003 — admin review: approvals made before sign-up reach the account, and every review records
-- who made it. No admin function: admins already read all profiles and applications under RLS,
-- so the admin UI joins them client-side.

-- ---------- Approved before sign-up ----------
-- AFTER INSERT triggers on auth.users fire alphabetically. The old `on_auth_user_confirmed` ran before
-- `on_auth_user_created`, so an already-confirmed insert linked its applications before its profile
-- existed. The new name sorts after `on_auth_user_created`.
drop trigger on_auth_user_confirmed on auth.users;

-- Link only after the email is confirmed (nobody claims someone else's answers). Mirrors
-- sync_application_status: if an application linked in this step was already reviewed, the still-pending
-- profile takes its outcome (approved wins over declined); profiles_protect then assigns the catalogue
-- number and member_since. A profile that already has a decision is left alone.
create or replace function public.link_applications()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _status public.membership_status;
begin
  if new.email_confirmed_at is not null then
    with linked as (
      update public.applications set user_id = new.id
      where user_id is null and lower(email) = lower(new.email)
      returning status
    )
    select case when bool_or(status = 'approved') then 'approved'
                when bool_or(status = 'declined') then 'declined' end::public.membership_status
      into _status from linked;
    if _status is not null then
      update public.profiles set status = _status where id = new.id and status = 'pending';
    end if;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_link_applications after insert or update of email_confirmed_at on auth.users
  for each row execute function public.link_applications();

-- The link trigger scans by lower(email).
create index on public.applications (lower(email));

-- ---------- Who reviewed it ----------
alter table public.applications add column reviewed_by uuid references auth.users(id) on delete set null;

-- reviewed_by and reviewed_at are set only by a status change, never written directly. Without one,
-- reviewed_by may still become null (the FK's ON DELETE SET NULL) but never another uuid.
create or replace function public.sync_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
    if new.user_id is not null then
      update public.profiles set status = new.status where id = new.user_id;
    end if;
  else
    new.reviewed_at := old.reviewed_at;
    if new.reviewed_by is not null then
      new.reviewed_by := old.reviewed_by;
    end if;
  end if;
  return new;
end $$;

-- Applicants can't arrive pre-reviewed.
drop policy "Anyone applies" on public.applications;
create policy "Anyone applies" on public.applications for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and reviewed_by is null
              and (user_id is null or user_id = auth.uid()));

-- ---------- Backfill ----------
-- Accounts confirmed under the old trigger order got linked without their reviewed outcome. Same rule
-- as link_applications: still-pending profiles take approved over declined. Runs once here; kept as a
-- function so the harness can exercise it. Not callable by clients.
create function public.backfill_linked_application_status()
returns void language sql security definer set search_path = public as $$
  update public.profiles p set status = s.status
  from (
    select user_id,
           case when bool_or(status = 'approved') then 'approved'
                when bool_or(status = 'declined') then 'declined' end::public.membership_status as status
    from public.applications
    where user_id is not null
    group by user_id
  ) s
  where p.id = s.user_id and p.status = 'pending' and s.status is not null
$$;
revoke execute on function public.backfill_linked_application_status() from public, anon, authenticated;
select public.backfill_linked_application_status();
