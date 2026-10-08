-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 006: CK Staff role + name stamped from the login  (v3.1)
--
-- Run in Supabase > SQL Editor AFTER 004 and 005. Safe to re-run.
--
-- What it does:
--   * Adds a 4th role: ck_staff — Stock In / Stock Out / DOs, no Manager.
--   * Every new movement and DO gets the logged-in person's display name
--     written by the DATABASE, not the screen. The name picker is gone;
--     the login is the identity.
--   * The old `staff` table is left exactly as it is, so historical rows
--     keep the names they were logged with.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Allow the new role
-- ---------------------------------------------------------------------
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('super_admin', 'ck_incharge', 'ck_staff', 'branch'));


-- ---------------------------------------------------------------------
-- 2. CK Staff counts as CK for stock work
--
-- is_ck() is what the access rules and create_stock_out() check, so this
-- one change lets CK Staff read stock, do Stock In and do Stock Out.
-- Manager actions (items, branches, accounts) are checked separately on
-- the server and stay Super Admin / CK Incharge only.
-- ---------------------------------------------------------------------
create or replace function public.is_ck()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_app_role() in ('super_admin', 'ck_incharge', 'ck_staff'),
    false
  )
$$;


-- ---------------------------------------------------------------------
-- 3. Stamp the real name on every new row
--
-- Runs before each insert. If a logged-in account is doing the insert,
-- its display name overwrites whatever name the screen sent. So the
-- "Staff Name" on a DO is always the person who was actually logged in.
-- ---------------------------------------------------------------------
create or replace function public.stamp_account_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is not null then
    select display_name into v_name
    from public.app_users
    where id = auth.uid() and is_active;

    if v_name is not null then
      new.staff_name := v_name;
      new.staff_id   := null;      -- old name-picker link, no longer used
      new.user_id    := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_account_name on public.stock_movements;
create trigger stamp_account_name
  before insert on public.stock_movements
  for each row execute function public.stamp_account_name();

drop trigger if exists stamp_account_name on public.delivery_orders;
create trigger stamp_account_name
  before insert on public.delivery_orders
  for each row execute function public.stamp_account_name();


-- ---------------------------------------------------------------------
-- Check (optional):
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'public.app_users'::regclass and conname = 'app_users_role_check';
-- → should list ck_staff
-- ---------------------------------------------------------------------
