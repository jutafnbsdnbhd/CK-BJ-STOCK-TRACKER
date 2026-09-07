-- =====================================================================
-- A'rest Bukit Jalil Central Kitchen — Stock Tracker
-- seed.sql  (v1.0.0)
-- Run this AFTER schema.sql, in Supabase > SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STAFF — placeholder. Replace via Manager > Staff after launch.
-- ---------------------------------------------------------------------
insert into public.staff (name) values
  ('Manager')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- BRANCHES — stock-out destinations. Placeholder.
-- Replace with the real Bukit Jalil destination list via Manager > Branches.
-- ---------------------------------------------------------------------
insert into public.branches (name) values
  ('Branch 1')
on conflict do nothing;

-- =====================================================================
-- ITEMS
-- ---------------------------------------------------------------------
-- ⚠️  THE LIST BELOW IS A PLACEHOLDER, NOT YOUR BATU PAHAT LIST.
--
-- Replace it with the real Bukit Jalil store item list before go-live.
-- Two ways to do that:
--   1. Paste your real list to Claude and get a finished seed.sql back, or
--   2. Delete the rows below, keep the format, and type your own:
--        ('Item name', 'Category', 'uom'),
--
-- Valid categories (this exact spelling drives the on-screen order):
--   'Proteins/Mains'  →  'Sauces/Bases'  →  'Pantry/Condiments'  →  'Misc'
-- Anything else still works but sorts to the bottom.
--
-- UOM is free text — kg, g, pcs, pkt, btl, ctn, tray, ltr — whatever the
-- store actually counts in. Count in the unit staff physically handle.
-- =====================================================================

insert into public.items (name, category, uom) values
  ('Chicken Breast',        'Proteins/Mains',    'kg'),
  ('Chicken Thigh',         'Proteins/Mains',    'kg'),
  ('Beef Patty',            'Proteins/Mains',    'pcs'),
  ('Salmon Fillet',         'Proteins/Mains',    'kg'),

  ('Tomato Base',           'Sauces/Bases',      'ltr'),
  ('Mushroom Sauce',        'Sauces/Bases',      'ltr'),
  ('Chilli Paste',          'Sauces/Bases',      'kg'),

  ('All Purpose Flour',     'Pantry/Condiments', 'kg'),
  ('Caster Sugar',          'Pantry/Condiments', 'kg'),
  ('Cooking Oil',           'Pantry/Condiments', 'ltr'),
  ('Salt',                  'Pantry/Condiments', 'kg'),

  ('Vacuum Bag',            'Misc',              'pcs')
on conflict do nothing;
