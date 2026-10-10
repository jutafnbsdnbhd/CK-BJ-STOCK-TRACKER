-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 009: Process POs — Convert to DO, or Reject  (Phase 3)
--
-- Run in Supabase > SQL Editor AFTER 008. Safe to re-run.
--
-- Convert:  CK sets "qty to send" per line (0 = not available) → one DO is
--           created, dated on the PO's DELIVERY date, stock is deducted,
--           and the PO becomes "converted" — all in one transaction.
-- Reject:   CK rejects the whole PO with a reason the branch can see.
--
-- Both lock the PO row first, so two people tapping at the same moment
-- cannot convert it twice. The second one gets "Already converted".
-- Who: every CK account (Super Admin, CK Incharge, CK Staff).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Who processed it, and when
-- ---------------------------------------------------------------------
alter table public.purchase_orders add column if not exists converted_at timestamptz;
alter table public.purchase_orders add column if not exists converted_by uuid references auth.users(id);
alter table public.purchase_orders add column if not exists rejected_at  timestamptz;
alter table public.purchase_orders add column if not exists rejected_by  uuid references auth.users(id);

-- One PO → one DO. A DO can belong to at most one PO.
create unique index if not exists purchase_orders_do_id_key
  on public.purchase_orders (do_id) where do_id is not null;


-- ---------------------------------------------------------------------
-- 2. convert_po_to_do
--
-- p_lines: [{ "item_id": uuid, "quantity": number }, ...]
--   * every item must be on the PO (CK cannot add new items here)
--   * quantity 0 = "not available" — it still prints on the DO, marked
--   * at least one line above 0 — if nothing can be sent, Reject instead
-- ---------------------------------------------------------------------
create or replace function public.convert_po_to_do(
  p_po_id uuid,
  p_lines jsonb,
  p_note  text
)
returns public.delivery_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po     public.purchase_orders;
  v_do     public.delivery_orders;
  v_staff  text;
  v_note   text := nullif(btrim(p_note), '');
  v_number text;
  v_sent   int;
begin
  if not public.is_ck() then
    raise exception 'Only CK Store accounts can process purchase orders';
  end if;

  -- Lock the PO. A second person converting at the same moment waits
  -- here, then sees status = converted below and is stopped.
  select * into v_po from public.purchase_orders where id = p_po_id for update;

  if v_po.id is null then
    raise exception 'Purchase order not found';
  end if;

  if v_po.status = 'converted' then
    raise exception 'Already converted to %',
      (select do_number from public.delivery_orders where id = v_po.do_id);
  end if;
  if v_po.status <> 'submitted' then
    raise exception 'This purchase order is % and cannot be converted', v_po.status;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Lines must be an array';
  end if;

  -- Every line must be an item from this PO, quantity 0 or more, no repeats
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    where (l->>'quantity') is null
       or (l->>'quantity')::numeric < 0
       or not exists (
         select 1 from public.purchase_order_items pi
         where pi.po_id = v_po.id and pi.item_id = (l->>'item_id')::uuid
       )
  ) then
    raise exception 'Invalid line: only items on this PO, quantity 0 or more';
  end if;

  if (select count(*) from jsonb_array_elements(p_lines))
     <> (select count(distinct l->>'item_id') from jsonb_array_elements(p_lines) l) then
    raise exception 'The same item appears twice';
  end if;

  select count(*) into v_sent
  from jsonb_array_elements(p_lines) l
  where (l->>'quantity')::numeric > 0;

  if v_sent = 0 then
    raise exception 'Nothing to send. If CK cannot fulfil this PO, use Reject instead.';
  end if;

  select display_name into v_staff from public.app_users where id = auth.uid();

  v_number := public.next_do_number_for_branch(v_po.branch_id, v_po.delivery_date);

  insert into public.delivery_orders (do_number, branch_id, staff_id, staff_name, note, do_date)
  values (v_number, v_po.branch_id, null, v_staff, v_note, v_po.delivery_date)
  returning * into v_do;

  insert into public.stock_movements
    (item_id, movement_type, quantity, branch_id, note, staff_id, staff_name, do_id)
  select
    (l->>'item_id')::uuid,
    'out',
    (l->>'quantity')::numeric,
    v_po.branch_id,
    coalesce(v_note, v_po.po_number),
    null,
    v_staff,
    v_do.id
  from jsonb_array_elements(p_lines) l
  where (l->>'quantity')::numeric > 0;

  update public.purchase_orders
     set status = 'converted',
         do_id = v_do.id,
         converted_at = now(),
         converted_by = auth.uid()
   where id = v_po.id;

  return v_do;
end;
$$;

revoke execute on function public.convert_po_to_do(uuid, jsonb, text) from public, anon;
grant  execute on function public.convert_po_to_do(uuid, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. reject_po — reason required, shown to the branch
-- ---------------------------------------------------------------------
create or replace function public.reject_po(p_po_id uuid, p_reason text)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po     public.purchase_orders;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not public.is_ck() then
    raise exception 'Only CK Store accounts can reject purchase orders';
  end if;

  if v_reason is null then
    raise exception 'A reason is required to reject a purchase order';
  end if;

  select * into v_po from public.purchase_orders where id = p_po_id for update;

  if v_po.id is null then
    raise exception 'Purchase order not found';
  end if;
  if v_po.status <> 'submitted' then
    raise exception 'This purchase order is already % and cannot be rejected', v_po.status;
  end if;

  update public.purchase_orders
     set status = 'rejected',
         reject_reason = v_reason,
         rejected_at = now(),
         rejected_by = auth.uid()
   where id = p_po_id
  returning * into v_po;

  return v_po;
end;
$$;

revoke execute on function public.reject_po(uuid, text) from public, anon;
grant  execute on function public.reject_po(uuid, text) to authenticated;
