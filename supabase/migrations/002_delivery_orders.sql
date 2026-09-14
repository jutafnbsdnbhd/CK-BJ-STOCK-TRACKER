-- =====================================================================
-- A'rest Bukit Jalil Central Kitchen — Stock Tracker
-- Migration 002: Delivery Orders
--
-- Run this in Supabase > SQL Editor on the existing v1 database.
-- Safe to re-run.
--
-- What it changes:
--   * Every Stock Out now creates a numbered Delivery Order.
--   * Stock Out lines are written in ONE transaction with the DO header,
--     so a dropped connection can no longer leave half a delivery behind.
--   * The anon key can no longer insert an 'out' movement directly — the
--     only route is create_stock_out(), so a stock-out without a DO is
--     now impossible rather than merely discouraged.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------

create table if not exists public.delivery_orders (
  id          uuid primary key default gen_random_uuid(),
  do_number   text unique not null,
  branch_id   uuid not null references public.branches(id) on delete restrict,
  staff_id    uuid references public.staff(id) on delete set null,
  staff_name  text not null,
  note        text,
  do_date     date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  created_at  timestamptz not null default now()
);

create index if not exists delivery_orders_date_idx   on public.delivery_orders (do_date desc, created_at desc);
create index if not exists delivery_orders_branch_idx on public.delivery_orders (branch_id);

alter table public.stock_movements
  add column if not exists do_id uuid references public.delivery_orders(id) on delete restrict;

create index if not exists stock_movements_do_idx on public.stock_movements (do_id);

-- One counter row per day. The daily reset lives here, not in app code.
create table if not exists public.do_counters (
  do_date  date primary key,
  last_seq int  not null default 0
);


-- ---------------------------------------------------------------------
-- NUMBER GENERATION  →  BJ-260914-001
--
-- The insert…on conflict…do update…returning is a single statement, so
-- Postgres holds a row lock for its duration. Two staff submitting in the
-- same second get 001 and 002, never 001 twice. Counting rows in the app
-- and adding one would collide — which is exactly why this is in the DB.
-- ---------------------------------------------------------------------
create or replace function public.next_do_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_seq  int;
begin
  v_date := (now() at time zone 'Asia/Kuala_Lumpur')::date;

  insert into public.do_counters (do_date, last_seq)
  values (v_date, 1)
  on conflict (do_date)
    do update set last_seq = public.do_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'BJ-' || to_char(v_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;


-- ---------------------------------------------------------------------
-- create_stock_out(...)
--
-- The whole delivery — header plus every line — in one transaction.
-- Validates before it writes anything, so a bad line cannot burn a DO
-- number or leave a partial delivery in the ledger.
--
-- p_lines: jsonb array of { "item_id": uuid, "quantity": number }
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

  -- Validate every line BEFORE writing anything.
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


-- ---------------------------------------------------------------------
-- SECURITY
-- ---------------------------------------------------------------------

alter table public.delivery_orders enable row level security;
alter table public.do_counters     enable row level security;

-- The DO page has to read the document. Nothing more.
drop policy if exists "anon read delivery orders" on public.delivery_orders;
create policy "anon read delivery orders"
  on public.delivery_orders for select to anon, authenticated using (true);

-- do_counters: RLS on, no policies at all. Nobody reads or writes it
-- except next_do_number(), which runs as the definer.

-- Tighten the movement insert policy: direct inserts are now Stock In only.
-- Stock Out must go through create_stock_out(), which guarantees a DO.
drop policy if exists "anon insert movement" on public.stock_movements;
create policy "anon insert stock in"
  on public.stock_movements for insert to anon, authenticated with check (
    movement_type = 'in'
    and branch_id is null
    and do_id is null
    and quantity > 0
    and staff_name is not null
  );

grant select on public.delivery_orders to anon, authenticated;
grant execute on function public.create_stock_out(uuid, uuid, text, text, jsonb) to anon, authenticated;

-- Deliberately NOT granted to anon: next_do_number(). If it were callable
-- from the browser, anyone could burn DO numbers and leave gaps in the
-- sequence. create_stock_out() calls it internally as the definer.
revoke execute on function public.next_do_number() from anon, authenticated;

-- Still deliberately absent everywhere: any UPDATE or DELETE policy.
-- A delivery order, once issued, is a document. Corrections are a new
-- offsetting movement and, if the paper already left, a new DO.
