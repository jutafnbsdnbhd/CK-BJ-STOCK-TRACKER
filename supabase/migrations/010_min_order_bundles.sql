-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 010: Minimum order (bundles) + pack contents  (Phase 3.1)
--
-- Run in Supabase > SQL Editor AFTER 009. Safe to re-run.
-- Adds two things to every item:
--
--   min_order  — the bundle size. Branches must order in whole bundles:
--                min_order 25  →  25, 50, 75 … only
--                min_order 1   →  whole units only (1, 2, 3 — no 2.5)
--                blank (null)  →  no rule
--
--   pack_qty + pack_unit — what is inside ONE unit, for reference only,
--                e.g. Japanese Mayonnaise: 1 Ctn = 12 Pkt.
--                Stock still moves in the item's own unit (Ctn), never split.
--
-- The rule is checked by the DATABASE when a PO is submitted, so it holds
-- even if a screen is out of date. It does NOT apply to Stock In, manual
-- Stock Out, or CK's Convert to DO (CK may legitimately send less).
-- POs already submitted are not affected.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. New item fields
-- ---------------------------------------------------------------------
alter table public.items add column if not exists min_order int;
alter table public.items add column if not exists pack_qty  numeric;
alter table public.items add column if not exists pack_unit text;

alter table public.items drop constraint if exists items_min_order_check;
alter table public.items add constraint items_min_order_check
  check (min_order is null or min_order >= 1);

alter table public.items drop constraint if exists items_pack_qty_check;
alter table public.items add constraint items_pack_qty_check
  check (pack_qty is null or pack_qty > 0);


-- ---------------------------------------------------------------------
-- 2. create_po — same as 008, plus the bundle rule per line
-- ---------------------------------------------------------------------
create or replace function public.create_po(
  p_branch_id  uuid,
  p_ordered_by text,
  p_note       text,
  p_lines      jsonb
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text := public.current_app_role();
  v_branch   uuid;
  v_po       public.purchase_orders;
  v_count    int;
  v_distinct int;
  v_bad      record;
  v_by       text := nullif(btrim(p_ordered_by), '');
  v_note     text := nullif(btrim(p_note), '');
  v_today    date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if v_role = 'branch' then
    v_branch := public.current_app_branch();
  elsif v_role = 'super_admin' then
    v_branch := p_branch_id;
  else
    raise exception 'Only branch accounts can place a purchase order';
  end if;

  if v_by is null then
    raise exception 'Please fill in who is ordering';
  end if;

  if v_branch is null or not exists (
    select 1 from public.branches where id = v_branch and is_active
  ) then
    raise exception 'Unknown or inactive branch';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Lines must be an array';
  end if;

  select count(*), count(distinct l->>'item_id')
    into v_count, v_distinct
  from jsonb_array_elements(p_lines) l;

  if v_count = 0 then
    raise exception 'A purchase order needs at least one item';
  end if;
  if v_count > 300 then
    raise exception 'Too many lines in one purchase order';
  end if;
  if v_distinct <> v_count then
    raise exception 'The same item appears twice';
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

  -- Bundle rule: quantity must be a whole number of bundles.
  select i.name, i.min_order, i.uom, (l->>'quantity')::numeric as qty
    into v_bad
  from jsonb_array_elements(p_lines) l
  join public.items i on i.id = (l->>'item_id')::uuid
  where i.min_order is not null
    and mod((l->>'quantity')::numeric, i.min_order) <> 0
  limit 1;

  if found then
    if v_bad.min_order = 1 then
      raise exception '%: whole % only (no decimals)', v_bad.name, v_bad.uom;
    else
      raise exception '%: order in bundles of % % (%, %, % …)',
        v_bad.name, v_bad.min_order, v_bad.uom,
        v_bad.min_order, v_bad.min_order * 2, v_bad.min_order * 3;
    end if;
  end if;

  insert into public.purchase_orders
    (po_number, branch_id, ordered_by, note, po_date, delivery_date, status)
  values
    (public.next_po_number_for_branch(v_branch, v_today),
     v_branch, v_by, v_note, v_today, v_today + 1, 'submitted')
  returning * into v_po;

  insert into public.purchase_order_items (po_id, item_id, qty_requested)
  select v_po.id, (l->>'item_id')::uuid, (l->>'quantity')::numeric
  from jsonb_array_elements(p_lines) l;

  return v_po;
end;
$$;

revoke execute on function public.create_po(uuid, text, text, jsonb) from public, anon;
grant  execute on function public.create_po(uuid, text, text, jsonb) to authenticated;
