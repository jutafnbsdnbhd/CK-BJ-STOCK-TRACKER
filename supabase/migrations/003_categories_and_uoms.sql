-- =====================================================================
-- Migration 003: align categories, item names and UOMs with the printed
-- Delivery Order template (TEST DO, 14 Sep 2026).
--
-- Run in Supabase > SQL Editor after 002. Safe to re-run.
--
-- Why: the app and the paper DO were using two different vocabularies.
-- One vocabulary or the document and the screen drift apart.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Category names → the template's
-- ---------------------------------------------------------------------
update public.items set category = 'Protein / Ready Item' where category in ('Proteins/Mains', 'Proteins / Mains');
update public.items set category = 'Sauce & Curry'        where category in ('Sauces/Bases', 'Sauces / Bases');
update public.items set category = 'Condiment & Oil'      where category in ('Pantry/Condiments', 'Pantry / Condiments');
update public.items set category = 'Off Season'           where category in ('Misc');

-- ---------------------------------------------------------------------
-- 2. Item names — the unit belongs in the UNIT column, not the name
-- ---------------------------------------------------------------------
update public.items set name = 'Cooking Oil'   where name = 'Cooking Oil (Tin)';
update public.items set name = 'Japanese Rice' where name = 'Japanese Rice (Ctn)';

-- ---------------------------------------------------------------------
-- 3. UOMs — every one taken from the template, no guesses
-- ---------------------------------------------------------------------
update public.items set uom = 'Pkt'  where name in (
  'Angus Beef','Beef Pepperoni','Chicken Breast','Chicken Chop','Chicken Pepperoni',
  'Chicken Wing','Minced Beef','Minced Chicken','Pasta','Perch Fish','Perch Fish Cube',
  'Roasted Beef','Roasted Soup','Salmon Don','Salmon Ochazuke','Salmon Pizza','Seafood',
  'Shark Meat','Smoke Duck Pasta','Smoke Duck Pizza',
  'Asam Pedas','Dashi Powder','Dry Curry','Fried Powder','Japanese Curry','Mala Base',
  'Mapo Tofu Sauce','Mutton Curry','Tomato Bolognese',
  'Durian Paste','Fried Garlic','Fried Onion','Scallion Oil','Teriyaki Sauce','Truffle Sauce',
  'Black Pepper','Potato Wedges','Spring Chicken'
);

update public.items set uom = 'Tray' where name = 'Tempura Prawn';
update public.items set uom = 'Box'  where name in ('Unagi', 'Tobiko');
update public.items set uom = 'Btl'  where name = 'Black Truffle';
update public.items set uom = 'Tin'  where name = 'Cooking Oil';
update public.items set uom = 'Ctn'  where name = 'Japanese Rice';

-- ---------------------------------------------------------------------
-- Check: should be 22 / 10 / 9 / 3 and no item left on 'pcs'
-- ---------------------------------------------------------------------
-- select category, count(*) from public.items where is_active group by category order by 1;
-- select name, uom from public.items where uom = 'pcs' and is_active;
