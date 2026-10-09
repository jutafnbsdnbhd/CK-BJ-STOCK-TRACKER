-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 008: Purchase Orders from branches  (Phase 2)
--
-- Run in Supabase > SQL Editor AFTER 007. Safe to re-run.
--
-- Flow:  branch places PO  →  shares PDF to CK WhatsApp group
--        →  (Phase 3) CK converts it to a DO.
--
-- PO number:  PO-TRX-261008-001  (branch code, own counter per day)
-- PO date = today (Malaysia time). Delivery date = PO date + 1.
--
-- A PO is never edited after submitting — only cancelled (while still
-- "submitted") and placed again. So the PDF in WhatsApp always matches
-- the app.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  po_number      text not null unique,
  branch_id      uuid not null references public.branches(id) on delete restrict,
  ordered_by     text not null check (length(btrim(ordered_by)) > 0),
  note           text,
  po_date        date not null,
  delivery_date  date not null,
  status         text not null default 'submitted'
                   check (status in ('submitted', 'converted', 'rejected', 'cancelled')),
  reject_reason  text,                                   -- Phase 3
  do_id          uuid references public.delivery_orders(id) on delete restrict,  -- Phase 3
  created_by     uuid default auth.uid() references auth.users(id),
  created_at     timestamptz not null default now(),
  cancelled_at   timestamptz,
  cancelled_by   uuid references auth.users(id)
);

create index if not exists purchase_orders_branch_idx
  on public.purchase_orders (branch_id, created_at desc);
create index if not exists purchase_orders_status_idx
  on public.purchase_orders (status, delivery_date);

create table if not exists public.purchase_order_items (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid not null references public.purchase_orders(id) on delete restrict,
  item_id        uuid not null references public.items(id) on delete restrict,
  qty_requested  numeric not null check (qty_requested > 0),
  unique (po_id, item_id)
);

create index if not exists purchase_order_items_po_idx
  on public.purchase_order_items (po_id);


-- ---------------------------------------------------------------------
-- 2. PO numbering — PO-TRX-261008-001
-- ---------------------------------------------------------------------
create table if not exists public.po_branch_counters (
  branch_id  uuid not null references public.branches(id) on delete restrict,
  po_date    date not null,
  last_seq   int  not null default 0,
  primary key (branch_id, po_date)
);

alter table public.po_branch_counters enable row level security;
revoke all on public.po_branch_counters from anon, authenticated;

create or replace function public.next_po_number_for_branch(p_branch_id uuid, p_date date)
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
    raise exception 'This branch has no code yet. Ask CK to set one in Manager > Branches.';
  end if;

  insert into public.po_branch_counters (branch_id, po_date, last_seq)
  values (p_branch_id, p_date, 1)
  on conflict (branch_id, po_date)
    do update set last_seq = public.po_branch_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'PO-' || v_code || '-' || to_char(p_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke execute on function public.next_po_number_for_branch(uuid, date) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. create_po — the only way a PO gets into the database
--
-- A branch account always orders for ITS OWN branch (p_branch_id is
-- ignored for them). Super Admin must say which branch.
-- Header + every line land together, or nothing does.
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


-- ---------------------------------------------------------------------
-- 4. cancel_po — branch cancels its own PO, only while still "submitted"
-- ---------------------------------------------------------------------
create or replace function public.cancel_po(p_po_id uuid)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_po   public.purchase_orders;
begin
  select * into v_po from public.purchase_orders where id = p_po_id for update;

  if v_po.id is null then
    raise exception 'Purchase order not found';
  end if;

  if not (
    v_role = 'super_admin'
    or (v_role = 'branch' and v_po.branch_id = public.current_app_branch())
  ) then
    raise exception 'You cannot cancel this purchase order';
  end if;

  if v_po.status <> 'submitted' then
    raise exception 'This purchase order is already % and can no longer be cancelled', v_po.status;
  end if;

  update public.purchase_orders
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
   where id = p_po_id
  returning * into v_po;

  return v_po;
end;
$$;

revoke execute on function public.cancel_po(uuid) from public, anon;
grant  execute on function public.cancel_po(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Who can see POs
--   CK (all CK roles + Super Admin): every PO
--   Branch: its own POs only
-- No insert/update/delete rules — the two functions above are the only
-- way in.
-- ---------------------------------------------------------------------
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "ck or own branch read POs" on public.purchase_orders;
create policy "ck or own branch read POs"
  on public.purchase_orders for select to authenticated
  using (public.is_ck() or branch_id = public.current_app_branch());

drop policy if exists "ck or own branch read PO lines" on public.purchase_order_items;
create policy "ck or own branch read PO lines"
  on public.purchase_order_items for select to authenticated
  using (
    exists (
      select 1 from public.purchase_orders p
      where p.id = po_id
        and (public.is_ck() or p.branch_id = public.current_app_branch())
    )
  );

revoke all on public.purchase_orders      from anon;
revoke all on public.purchase_order_items from anon;
grant select on public.purchase_orders, public.purchase_order_items to authenticated;
