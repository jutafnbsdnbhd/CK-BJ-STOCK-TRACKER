-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 007: Branch codes + DO numbers per branch  (v3.2)
--
-- Run in Supabase > SQL Editor AFTER 006. Safe to re-run.
--
--   Before:  BJ-261008-001   (one counter for all branches)
--   After:   TRX-261008-001  (branch code, own counter per branch per day)
--
-- Old DOs keep their old numbers — they are never renumbered, because
-- paper copies with those numbers already exist.
-- The same branch codes will be used for PO numbers in Phase 2.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Branch code — 2 to 5 capital letters, unique, e.g. TRX, UPT, ABJ
-- ---------------------------------------------------------------------
alter table public.branches add column if not exists code text;

alter table public.branches drop constraint if exists branches_code_format;
alter table public.branches add constraint branches_code_format
  check (code is null or code ~ '^[A-Z]{2,5}$');

create unique index if not exists branches_code_key
  on public.branches (code) where code is not null;


-- ---------------------------------------------------------------------
-- 2. Code guard
--   * tidies the input: " trx " → "TRX", blank → empty (null)
--   * LOCKS the code once a DO has been issued with it. Changing TRX to
--     TRXX after 50 deliveries would make the history inconsistent.
-- ---------------------------------------------------------------------
create or replace function public.branches_code_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := nullif(upper(btrim(new.code)), '');

  if tg_op = 'UPDATE'
     and old.code is not null
     and new.code is distinct from old.code
     and exists (
       select 1 from public.delivery_orders d
       where d.branch_id = old.id
         and d.do_number like old.code || '-%'
     )
  then
    raise exception 'Code % is locked — delivery orders have already been issued with it', old.code;
  end if;

  return new;
end;
$$;

drop trigger if exists branches_code_guard on public.branches;
create trigger branches_code_guard
  before insert or update on public.branches
  for each row execute function public.branches_code_guard();


-- ---------------------------------------------------------------------
-- 3. One counter per branch per day
-- ---------------------------------------------------------------------
create table if not exists public.do_branch_counters (
  branch_id  uuid not null references public.branches(id) on delete restrict,
  do_date    date not null,
  last_seq   int  not null default 0,
  primary key (branch_id, do_date)
);

-- Nobody reads or writes this directly; only the numbering function.
alter table public.do_branch_counters enable row level security;
revoke all on public.do_branch_counters from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. Number generator → TRX-261008-001
--
-- Same row-lock trick as before: two people sending to TRX in the same
-- second get 001 and 002, never 001 twice. If the delivery fails, the
-- whole transaction rolls back — including the counter — so no gaps.
-- ---------------------------------------------------------------------
create or replace function public.next_do_number_for_branch(p_branch_id uuid, p_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_seq  int;
begin
  select code into v_code from public.branches where id = p_branch_id;

  if v_code is null then
    raise exception 'This branch has no code yet. Set one in Manager > Branches first.';
  end if;

  insert into public.do_branch_counters (branch_id, do_date, last_seq)
  values (p_branch_id, p_date, 1)
  on conflict (branch_id, do_date)
    do update set last_seq = public.do_branch_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_code || '-' || to_char(p_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke execute on function public.next_do_number_for_branch(uuid, date) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. create_stock_out — same as 005, now numbered per branch
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
  v_today  date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
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

  v_number := public.next_do_number_for_branch(p_branch_id, v_today);

  insert into public.delivery_orders (do_number, branch_id, staff_id, staff_name, note, do_date)
  values (v_number, p_branch_id, p_staff_id, v_staff, v_note, v_today)
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

-- The old shared counter (next_do_number / do_counters) is left in place,
-- unused, so nothing that references it breaks.
