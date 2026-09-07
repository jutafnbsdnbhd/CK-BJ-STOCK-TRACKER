-- =====================================================================
-- A'rest Bukit Jalil Central Kitchen — Stock Tracker
-- schema.sql  (v1.0.0)
-- Run this FIRST in Supabase > SQL Editor, then run seed.sql.
-- Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------

-- Who logged the entry. No passwords, no roles — this is a name tag.
create table if not exists public.staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Destinations for Stock Out.
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- The item master for this store.
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Misc',
  uom         text not null default 'pcs',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Append-only movement ledger. Never updated, never deleted.
-- A mistake is corrected with a new, offsetting entry.
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.items(id) on delete restrict,
  movement_type text not null check (movement_type in ('in', 'out')),
  quantity      numeric(14,3) not null check (quantity > 0),
  branch_id     uuid references public.branches(id) on delete restrict,
  note          text,
  staff_id      uuid references public.staff(id) on delete set null,
  staff_name    text not null,
  movement_date date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  created_at    timestamptz not null default now(),
  -- A stock-out must say where it went. A stock-in must not.
  constraint stock_movements_branch_rule check (
    (movement_type = 'out' and branch_id is not null) or
    (movement_type = 'in'  and branch_id is null)
  )
);

create index if not exists stock_movements_item_idx    on public.stock_movements (item_id);
create index if not exists stock_movements_date_idx    on public.stock_movements (movement_date desc);
create index if not exists stock_movements_created_idx on public.stock_movements (created_at desc);
create index if not exists items_active_idx            on public.items (is_active);

-- ---------------------------------------------------------------------
-- BALANCES VIEW  — live SUM(in) - SUM(out) per item
-- security_invoker = true so the caller's RLS applies, not the owner's.
-- ---------------------------------------------------------------------
create or replace view public.item_balances
with (security_invoker = true) as
select
  i.id            as item_id,
  i.name          as item_name,
  i.category,
  i.uom,
  i.is_active,
  coalesce(sum(case when m.movement_type = 'in'  then m.quantity end), 0)
    - coalesce(sum(case when m.movement_type = 'out' then m.quantity end), 0) as balance,
  coalesce(sum(case when m.movement_type = 'in'  then m.quantity end), 0) as total_in,
  coalesce(sum(case when m.movement_type = 'out' then m.quantity end), 0) as total_out,
  max(m.created_at) as last_movement_at
from public.items i
left join public.stock_movements m on m.item_id = i.id
group by i.id, i.name, i.category, i.uom, i.is_active;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- anon (the public app):  SELECT on all four tables
--                         INSERT on stock_movements only
--                         NO update or delete policy exists anywhere,
--                         so those operations are impossible via anon.
--
-- Manager writes go through /api/manager/* using the service role key,
-- which bypasses RLS and never reaches the browser.
-- ---------------------------------------------------------------------

alter table public.staff           enable row level security;
alter table public.branches        enable row level security;
alter table public.items           enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "anon read staff"      on public.staff;
drop policy if exists "anon read branches"   on public.branches;
drop policy if exists "anon read items"      on public.items;
drop policy if exists "anon read movements"  on public.stock_movements;
drop policy if exists "anon insert movement" on public.stock_movements;

create policy "anon read staff"
  on public.staff for select to anon, authenticated using (true);

create policy "anon read branches"
  on public.branches for select to anon, authenticated using (true);

create policy "anon read items"
  on public.items for select to anon, authenticated using (true);

create policy "anon read movements"
  on public.stock_movements for select to anon, authenticated using (true);

create policy "anon insert movement"
  on public.stock_movements for insert to anon, authenticated with check (
    quantity > 0
    and staff_name is not null
    and (
      (movement_type = 'out' and branch_id is not null) or
      (movement_type = 'in'  and branch_id is null)
    )
  );

-- Deliberately absent: any UPDATE or DELETE policy on any table.
-- The ledger is append-only by construction, not by convention.

grant usage on schema public to anon, authenticated;
grant select on public.staff, public.branches, public.items, public.stock_movements to anon, authenticated;
grant select on public.item_balances to anon, authenticated;
grant insert on public.stock_movements to anon, authenticated;
