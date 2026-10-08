-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 004: Accounts and roles  (Phase 1, part 1 of 2)
--
-- Run in Supabase > SQL Editor. Safe to re-run.
--
-- ADDITIVE ONLY. This adds the accounts table, the role helper functions
-- and the new logged-in access rules. It does NOT remove the old open
-- rules, so the app that is live right now keeps working while the new
-- code is deployed. Migration 005 removes the old rules afterwards.
--
-- Roles:
--   super_admin  — everything
--   ck_incharge  — CK Store: stock in/out, manager tabs, CK accounts
--   branch       — one branch's purchase orders and delivery orders
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ACCOUNTS
--
-- One row per login. The login itself (password) lives in Supabase Auth;
-- this row says who the person is and what they may do.
--
-- Never deleted. A leaver is deactivated (is_active = false), so every
-- historical record that points at them still reads correctly.
-- ---------------------------------------------------------------------
create table if not exists public.app_users (
  id            uuid primary key references auth.users(id) on delete restrict,
  username      text not null unique
                  check (username ~ '^[a-z0-9._-]{3,30}$'),
  display_name  text not null check (length(btrim(display_name)) > 0),
  role          text not null
                  check (role in ('super_admin', 'ck_incharge', 'branch')),
  branch_id     uuid references public.branches(id) on delete restrict,
  is_active     boolean not null default true,
  created_by    uuid references public.app_users(id) on delete set null,
  created_at    timestamptz not null default now(),

  -- A branch account must belong to a branch. Nobody else may.
  constraint app_users_branch_rule check (
    (role = 'branch' and branch_id is not null) or
    (role <> 'branch' and branch_id is null)
  )
);

create index if not exists app_users_role_idx on public.app_users (role);


-- ---------------------------------------------------------------------
-- 2. ROLE HELPERS
--
-- Used inside the access rules below. "security definer" so they can read
-- app_users without tripping over app_users' own access rules.
-- A deactivated account returns NULL here, so it loses all access the
-- moment it is deactivated — even if its login session is still open.
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_users
  where id = auth.uid() and is_active
$$;

create or replace function public.current_app_branch()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.app_users
  where id = auth.uid() and is_active
$$;

create or replace function public.is_ck()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('super_admin', 'ck_incharge'), false)
$$;

revoke execute on function public.current_app_role()   from public, anon;
revoke execute on function public.current_app_branch() from public, anon;
revoke execute on function public.is_ck()              from public, anon;
grant  execute on function public.current_app_role()   to authenticated;
grant  execute on function public.current_app_branch() to authenticated;
grant  execute on function public.is_ck()              to authenticated;


-- ---------------------------------------------------------------------
-- 3. WHO DID IT — the logged-in account behind every movement and DO
--
-- staff_name stays (that is the name picked on the CK device). user_id is
-- the account that was logged in. Filled automatically; old rows stay NULL.
-- ---------------------------------------------------------------------
alter table public.stock_movements
  add column if not exists user_id uuid default auth.uid() references auth.users(id);

alter table public.delivery_orders
  add column if not exists user_id uuid default auth.uid() references auth.users(id);


-- ---------------------------------------------------------------------
-- 4. NEW ACCESS RULES (for logged-in accounts)
--
-- These sit alongside the old open rules until migration 005.
-- ---------------------------------------------------------------------
alter table public.app_users enable row level security;

-- Everyone can read their own account row. Managing other accounts goes
-- through the server (/api/users), never straight from the browser.
drop policy if exists "read own account" on public.app_users;
create policy "read own account"
  on public.app_users for select to authenticated
  using (id = auth.uid());

-- Staff name list (the CK name picker): CK only.
drop policy if exists "ck read staff" on public.staff;
create policy "ck read staff"
  on public.staff for select to authenticated
  using (public.is_ck());

-- Branches and items: any active account (branches will need the item
-- list to place purchase orders in Phase 2).
drop policy if exists "accounts read branches" on public.branches;
create policy "accounts read branches"
  on public.branches for select to authenticated
  using (public.current_app_role() is not null);

drop policy if exists "accounts read items" on public.items;
create policy "accounts read items"
  on public.items for select to authenticated
  using (public.current_app_role() is not null);

-- Movements: CK sees everything. A branch sees only the delivery lines
-- that were sent to it — never stock-ins, never other branches.
drop policy if exists "ck or own branch read movements" on public.stock_movements;
create policy "ck or own branch read movements"
  on public.stock_movements for select to authenticated
  using (
    public.is_ck()
    or (do_id is not null and branch_id = public.current_app_branch())
  );

-- Stock In: CK only. (Stock Out goes through create_stock_out().)
drop policy if exists "ck insert stock in" on public.stock_movements;
create policy "ck insert stock in"
  on public.stock_movements for insert to authenticated
  with check (
    public.is_ck()
    and movement_type = 'in'
    and branch_id is null
    and do_id is null
    and quantity > 0
    and staff_name is not null
  );

-- Delivery orders: CK sees all; a branch sees its own.
drop policy if exists "ck or own branch read delivery orders" on public.delivery_orders;
create policy "ck or own branch read delivery orders"
  on public.delivery_orders for select to authenticated
  using (
    public.is_ck()
    or branch_id = public.current_app_branch()
  );

grant select on public.app_users to authenticated;

-- Still deliberately absent everywhere: any UPDATE or DELETE rule for the
-- browser. Accounts, items, staff and branches are changed only by the
-- server; the ledger and delivery orders are never changed at all.
