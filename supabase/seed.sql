-- =====================================================================
-- A'rest Bukit Jalil Central Kitchen — Stock Tracker
-- seed.sql  (v1.1 — real item list, 44 items)
--
-- Run this in Supabase > SQL Editor AFTER schema.sql.
-- Safe to re-run.
--
-- STEP 1 removes the 12 placeholder items that shipped with v1.0.
-- STEP 2 inserts the real list.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1 — remove the placeholder items
-- Deletes them outright if nothing has been logged against them.
-- Anything already used in a test movement is deactivated instead, so
-- the movement history stays readable.
-- ---------------------------------------------------------------------
delete from public.items i
where i.name in (
  'Chicken Breast','Chicken Thigh','Beef Patty','Salmon Fillet',
  'Tomato Base','Mushroom Sauce','Chilli Paste',
  'All Purpose Flour','Caster Sugar','Cooking Oil','Salt','Vacuum Bag'
)
and not exists (select 1 from public.stock_movements m where m.item_id = i.id);

update public.items set is_active = false
where name in (
  'Chicken Breast','Chicken Thigh','Beef Patty','Salmon Fillet',
  'Tomato Base','Mushroom Sauce','Chilli Paste',
  'All Purpose Flour','Caster Sugar','Cooking Oil','Salt','Vacuum Bag'
);


-- ---------------------------------------------------------------------
-- STEP 2 — the real item list
--
-- ⚠️ UOM WARNING
-- Only 5 of these 44 items had a unit in the source list. The other 39
-- are set to 'pcs' as a placeholder, NOT because that is correct.
-- Fix them in Manager > Items before staff start using this.
-- The 5 that are confirmed: Tobiko (pack), Cooking Oil (tin),
-- Japanese Rice (ctn), Black Pepper (kg), Potato Wedges (kg).
-- ---------------------------------------------------------------------

insert into public.items (name, category, uom) values
  -- Proteins / Mains (22)
  ('Angus Beef',          'Proteins/Mains',    'pcs'),
  ('Beef Pepperoni',      'Proteins/Mains',    'pcs'),
  ('Chicken Breast',      'Proteins/Mains',    'pcs'),
  ('Chicken Chop',        'Proteins/Mains',    'pcs'),
  ('Chicken Pepperoni',   'Proteins/Mains',    'pcs'),
  ('Chicken Wing',        'Proteins/Mains',    'pcs'),
  ('Minced Beef',         'Proteins/Mains',    'pcs'),
  ('Minced Chicken',      'Proteins/Mains',    'pcs'),
  ('Pasta',               'Proteins/Mains',    'pcs'),
  ('Perch Fish',          'Proteins/Mains',    'pcs'),
  ('Perch Fish Cube',     'Proteins/Mains',    'pcs'),
  ('Roasted Beef',        'Proteins/Mains',    'pcs'),
  ('Roasted Soup',        'Proteins/Mains',    'pcs'),
  ('Salmon Don',          'Proteins/Mains',    'pcs'),
  ('Salmon Ochazuke',     'Proteins/Mains',    'pcs'),
  ('Salmon Pizza',        'Proteins/Mains',    'pcs'),
  ('Seafood',             'Proteins/Mains',    'pcs'),
  ('Shark Meat',          'Proteins/Mains',    'pcs'),
  ('Smoke Duck Pasta',    'Proteins/Mains',    'pcs'),
  ('Smoke Duck Pizza',    'Proteins/Mains',    'pcs'),
  ('Tempura Prawn',       'Proteins/Mains',    'pcs'),
  ('Unagi',               'Proteins/Mains',    'pcs'),

  -- Sauces / Bases (10)
  ('Asam Pedas',          'Sauces/Bases',      'pcs'),
  ('Dashi Powder',        'Sauces/Bases',      'pcs'),
  ('Dry Curry',           'Sauces/Bases',      'pcs'),
  ('Fried Powder',        'Sauces/Bases',      'pcs'),
  ('Japanese Curry',      'Sauces/Bases',      'pcs'),
  ('Mala Base',           'Sauces/Bases',      'pcs'),
  ('Mapo Tofu Sauce',     'Sauces/Bases',      'pcs'),
  ('Mutton Curry',        'Sauces/Bases',      'pcs'),
  ('Tobiko',              'Sauces/Bases',      'pack'),
  ('Tomato Bolognese',    'Sauces/Bases',      'pcs'),

  -- Pantry / Condiments (9)
  ('Black Truffle',       'Pantry/Condiments', 'pcs'),
  ('Cooking Oil (Tin)',   'Pantry/Condiments', 'tin'),
  ('Durian Paste',        'Pantry/Condiments', 'pcs'),
  ('Fried Garlic',        'Pantry/Condiments', 'pcs'),
  ('Fried Onion',         'Pantry/Condiments', 'pcs'),
  ('Japanese Rice (Ctn)', 'Pantry/Condiments', 'ctn'),
  ('Scallion Oil',        'Pantry/Condiments', 'pcs'),
  ('Teriyaki Sauce',      'Pantry/Condiments', 'pcs'),
  ('Truffle Sauce',       'Pantry/Condiments', 'pcs'),

  -- Misc (3)
  ('Black Pepper',        'Misc',              'kg'),
  ('Potato Wedges',       'Misc',              'kg'),
  ('Spring Chicken',      'Misc',              'pcs')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- Placeholder staff + branch. Replace via Manager > Staff / Branches.
-- ---------------------------------------------------------------------
insert into public.staff (name)    select 'Manager'  where not exists (select 1 from public.staff);
insert into public.branches (name) select 'Branch 1' where not exists (select 1 from public.branches);


-- ---------------------------------------------------------------------
-- Check the result: should be 44 active items, 22 / 10 / 9 / 3.
-- ---------------------------------------------------------------------
-- select category, count(*) from public.items where is_active group by category order by 1;
