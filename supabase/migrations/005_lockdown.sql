-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 005: Lockdown  (Phase 1, part 2 of 2)
--
-- ⚠️ RUN ONLY AFTER the Phase 1 code is live on Vercel and you have
--    logged in successfully on the live site. Before that, this would
--    lock the old app out.
--
-- Run in Supabase > SQL Editor. Safe to re-run.
--
-- What it does:
--   * Removes the old "anyone with the website can read" rules.
--   * Removes all access for anonymous (not logged in) visitors.
--   * Only CK accounts can create a Stock Out / Delivery Order.
-- After this, the database itself enforces the roles — not just the screens.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Remove the old open rules
-- ---------------------------------------------------------------------
drop policy if exists "anon read staff"           on public.staff;
drop policy if exists "anon read branches"        on public.branches;
drop policy if exists "anon read items"           on public.items;
drop policy if exists "anon read movements"       on public.stock_movements;
drop policy if exists "anon insert movement"      on public.stock_movements;
drop policy if exists "anon insert stock in"      on public.stock_movements;
drop policy if exists "anon read delivery orders" on public.delivery_orders;


-- ---------------------------------------------------------------------
-- 2. Anonymous visitors get nothing
-- ---------------------------------------------------------------------
revoke all on public.staff           from anon;
revoke all on public.branches        from anon;
revoke all on public.items           from anon;
revoke all on public.stock_movements from anon;
revoke all on public.delivery_orders from anon;
revoke all on public.do_counters     from anon;
revoke all on public.app_users       from anon;
revoke all on public.item_balances   from anon;


-- ---------------------------------------------------------------------
-- 3. create_stock_out — same as v2, plus: only CK accounts may call it
--
-- It runs as "security definer" (it bypasses the access rules so it can
-- write the DO and its lines in one go), which is exactly why it has to
-- check the caller's role itself.
-- ---------------------------------------------------------------------
create or replace function public.create_stock_out(
  p_branch_id  uuid,
  p_staff_id   uuid,
  p_staff_name text,
  p_note       text,
  p_lines      jsonb
)
returns public.delivery_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_do     public.delivery_orders;
  v_number text;
  v_count  int;
  v_staff  text := nullif(btrim(p_staff_name), '');
  v_note   text := nullif(btrim(p_note), '');
begin
  if not public.is_ck() then
    raise exception 'Only CK Store accounts can create a stock out';
  end if;

  if v_staff is null then
    raise exception 'Staff name is required';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Lines must be an array';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_lines);
  if v_count = 0 then
    raise exception 'A delivery order needs at least one item';
  end if;
  if v_count > 300 then
    raise exception 'Too many lines in one delivery order';
  end if;

  if not exists (
    select 1 from public.branches
    where id = p_branch_id and is_active
  ) then
    raise exception 'Unknown or inactive destination branch';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) l
    where coalesce((l->>'quantity')::numeric, 0) <= 0
       or not exists (
         select 1 from public.items i
         where i.id = (l->>'item_id')::uuid and i.is_active
       )
  ) then
    raise exception 'Invalid line: quantity must be above zero and the item must exist';
  end if;

  v_number := public.next_do_number();

  insert into public.delivery_orders (do_number, branch_id, staff_id, staff_name, note)
  values (v_number, p_branch_id, p_staff_id, v_staff, v_note)
  returning * into v_do;

  insert into public.stock_movements
    (item_id, movement_type, quantity, branch_id, note, staff_id, staff_name, do_id)
  select
    (l->>'item_id')::uuid,
    'out',
    (l->>'quantity')::numeric,
    p_branch_id,
    v_note,
    p_staff_id,
    v_staff,
    v_do.id
  from jsonb_array_elements(p_lines) l;

  return v_do;
end;
$$;

revoke execute on function public.create_stock_out(uuid, uuid, text, text, jsonb) from public, anon;
grant  execute on function public.create_stock_out(uuid, uuid, text, text, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Logged-in accounts: read (rules above decide which rows), and
--    insert Stock In only. Nothing else.
-- ---------------------------------------------------------------------
grant select on public.staff, public.branches, public.items,
                public.stock_movements, public.delivery_orders,
                public.app_users, public.item_balances
  to authenticated;
grant insert on public.stock_movements to authenticated;


-- ---------------------------------------------------------------------
-- Check (run separately if you want to see the result):
-- select tablename, policyname, roles from pg_policies
-- where schemaname = 'public' order by tablename, policyname;
-- Every policy should show {authenticated}. None should show anon.
-- ---------------------------------------------------------------------
