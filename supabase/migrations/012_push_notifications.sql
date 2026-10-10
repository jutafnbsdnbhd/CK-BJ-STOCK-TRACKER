-- =====================================================================
-- CK Store (Bukit Jalil) — Stock Tracker
-- Migration 012: Phone notifications for new POs  (Phase 3b)
--
-- Run in Supabase > SQL Editor AFTER 010. Safe to re-run.
--
-- push_subscriptions: one row per phone that tapped "Turn on PO alerts".
--   Only the server (service role) reads or writes it — the browser has
--   no access at all.
-- purchase_orders.notified_at: set the moment the alert goes out, so the
--   same PO can never be announced twice.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.app_users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_ok_at    timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

alter table public.purchase_orders add column if not exists notified_at timestamptz;
