-- =====================================================================
-- STEP A — PREVIEW ONLY. Changes nothing. Run after migration 010.
--
-- Shows, for each of the 50 items on Homura's Minimum Order list:
--   what it is now  →  what it will become.
-- Check: 50 rows, "found" = true on every row, and the numbers look right.
-- Any row with found = false means that item ID is not in the database.
-- =====================================================================

with v(id, list_name, min_order, pack_qty, pack_unit, new_uom, new_name) as (values
  ('4ef66da4-8b34-4ae2-98ca-0609e9ae987e'::uuid, 'Angus Beef', 10::int, null::numeric, null::text, null::text, null::text),
  ('1ccb121f-322c-4d7b-bcc2-7ffc7386750c'::uuid, 'Beef Pepperoni', 1::int, null::numeric, null::text, null::text, null::text),
  ('169507c5-0518-41be-997c-5a03bd48fd2e'::uuid, 'Chicken Breast', 10::int, null::numeric, null::text, null::text, null::text),
  ('6697482e-308b-41b0-b111-b12c76b023fa'::uuid, 'Chicken Chop', 1::int, 8::numeric, 'pcs'::text, null::text, null::text),
  ('887eef89-4339-44bf-81be-b9f7e089f9b7'::uuid, 'Chicken Pepperoni', 1::int, null::numeric, null::text, null::text, null::text),
  ('8a130880-44ed-4b32-81ba-dfe201fc01ce'::uuid, 'Chicken Wing', 1::int, 10::numeric, 'pcs (5 wings + 5 drumsticks)'::text, null::text, null::text),
  ('180cc71d-8444-462d-821c-af5b33b7fdbd'::uuid, 'Handmade Noodle', 10::int, 5::numeric, 'pcs'::text, 'Pkt'::text, 'Handmade Noodle'::text),
  ('35fd3143-f3d4-430a-894b-a8e951351812'::uuid, 'Minced Beef', 10::int, null::numeric, null::text, null::text, null::text),
  ('939982f0-32a0-48a6-b2c8-6ba48990e6e8'::uuid, 'Minced Chicken', 10::int, null::numeric, null::text, null::text, null::text),
  ('6d2adf2d-d338-44fc-9990-6c70a588df02'::uuid, 'Pasta', 25::int, null::numeric, null::text, null::text, null::text),
  ('9c0cb4ec-1954-4736-99a2-f2a997e9b7ff'::uuid, 'Perch Fish', 20::int, null::numeric, null::text, null::text, null::text),
  ('1ddd02d3-b4b7-4e62-b920-f66c4f7e615d'::uuid, 'Perch Fish Cube', 10::int, null::numeric, null::text, null::text, null::text),
  ('29f22597-f1fa-4319-ba96-0bcd15292858'::uuid, 'Roasted Beef', 10::int, null::numeric, null::text, null::text, null::text),
  ('a83a1d5a-573f-4add-9ffb-88012093a79f'::uuid, 'Roasted Soup', 10::int, null::numeric, null::text, null::text, null::text),
  ('086a462d-ba70-457e-9e5f-060bf6242aff'::uuid, 'Salmon Don', 50::int, null::numeric, null::text, null::text, null::text),
  ('8e8dd14f-76f5-4f9b-89d8-b0ac3b55aabc'::uuid, 'Salmon Ochazuke', 10::int, null::numeric, null::text, null::text, null::text),
  ('342f76e0-1c9d-4d4b-9f47-dac29f8d3539'::uuid, 'Salmon Pizza', 50::int, null::numeric, null::text, null::text, null::text),
  ('747375ef-c5bf-4fa5-b8e1-a6dcd52da99e'::uuid, 'Seafood', 20::int, null::numeric, null::text, null::text, null::text),
  ('ea38d7b0-115e-465c-a8c2-2487c4052a2f'::uuid, 'Smoke Duck Pasta', 50::int, null::numeric, null::text, null::text, null::text),
  ('666af2da-82cf-426d-ab46-2d664fd1216e'::uuid, 'Smoke Duck Pizza', 50::int, null::numeric, null::text, null::text, null::text),
  ('564f0f32-1f17-4483-a0d0-b68837e699db'::uuid, 'Unagi', 1::int, 10::numeric, 'kg'::text, null::text, null::text),
  ('f5dfd004-0454-4b2f-9760-023c8309dacb'::uuid, 'Dashi Powder', 1::int, null::numeric, null::text, null::text, null::text),
  ('529b69e1-85cb-4e91-8134-01adb74b48c7'::uuid, 'Dry Curry', 10::int, null::numeric, null::text, null::text, null::text),
  ('8b048bb7-25aa-477e-8294-1a228f89e4ab'::uuid, 'Fried Powder', 1::int, null::numeric, null::text, null::text, null::text),
  ('8ba8fa53-600a-430a-bde7-96067b99378f'::uuid, 'Japanese Curry', 10::int, null::numeric, null::text, null::text, null::text),
  ('876c263b-1e9a-4839-af2b-8a376b909125'::uuid, 'Mala Base', 1::int, null::numeric, null::text, null::text, null::text),
  ('39bf6857-fafb-40a0-8d6c-e703c0493520'::uuid, 'Mapo Tofu Sauce', 1::int, null::numeric, null::text, null::text, null::text),
  ('0567ba05-b8a5-4145-871b-705be1967ded'::uuid, 'Mutton Curry', 10::int, null::numeric, null::text, null::text, null::text),
  ('6fbe4983-072b-4698-b32b-117c19cb108d'::uuid, 'Tomato Bolognese', 10::int, null::numeric, null::text, null::text, null::text),
  ('63c124ff-9c97-454c-890c-ac7013e3a12c'::uuid, 'Aromat Seasoning', 1::int, null::numeric, null::text, null::text, null::text),
  ('9cb8cefd-8aaf-4325-bdd6-129cfeed2c72'::uuid, 'Black Truffle', 1::int, null::numeric, null::text, null::text, null::text),
  ('c3d2d703-a57a-49ff-800a-9502a0e83427'::uuid, 'Black Vinegar Onion', 1::int, null::numeric, null::text, 'Btl'::text, null::text),
  ('508151b0-3877-4f31-afe7-2e1e97ef815f'::uuid, 'Fried Garlic', 1::int, null::numeric, null::text, null::text, null::text),
  ('69c11b0f-9134-42e4-8661-aafa5477f171'::uuid, 'Fried Onion', 1::int, null::numeric, null::text, null::text, null::text),
  ('43e6f57b-c3ca-4b80-b8fe-d28fed1bcf75'::uuid, 'Garbage Bag', 1::int, null::numeric, null::text, null::text, null::text),
  ('6a9ec368-85ee-48cc-bf3f-3dce343be7ee'::uuid, 'Honey Mustard', 1::int, null::numeric, null::text, null::text, null::text),
  ('569cd7ef-fd28-4c95-bda5-4771b5da590c'::uuid, 'Hot & Spicy Sauce', 1::int, null::numeric, null::text, 'Btl'::text, null::text),
  ('b37247a0-117b-4d03-b78a-aedfca5472ee'::uuid, 'Japanese Mayonnaise', 1::int, 12::numeric, 'Pkt'::text, null::text, null::text),
  ('c6f2032b-5df7-436d-8b2a-59f0f448ee68'::uuid, 'Japanese Rice', 1::int, 5::numeric, 'Pkt'::text, null::text, null::text),
  ('ed7d0e10-4462-4234-bc0e-286063f55600'::uuid, 'Lanzhou Base', 1::int, null::numeric, null::text, null::text, null::text),
  ('577bc92e-cde8-499c-aeb7-77fe5225c5eb'::uuid, 'Lanzhou Seasoning', 1::int, null::numeric, null::text, null::text, null::text),
  ('e5271610-2b44-4a79-a6a6-68da57b5ca63'::uuid, 'Layu Chilli Oil', 1::int, 6::numeric, 'Btl'::text, null::text, null::text),
  ('69c41597-fefc-4781-a18c-14c784728e2c'::uuid, 'LKK Light Soy Sauce', 1::int, null::numeric, null::text, 'Btl'::text, null::text),
  ('5c10fa3d-4ee7-4958-8729-3ee8c557fdde'::uuid, 'Mentai Sauce', 1::int, 12::numeric, 'Pkt'::text, null::text, null::text),
  ('28130605-f81d-4c3d-94f0-ef940cd65d14'::uuid, 'Scallion Oil', 1::int, null::numeric, null::text, null::text, null::text),
  ('40495372-e897-45db-b4e6-caaeaa024b1d'::uuid, 'Smoky BBQ Sauce', 1::int, 6::numeric, 'Btl'::text, null::text, null::text),
  ('5f3a4bde-42b9-46b9-ba1b-2e2b2754fcb5'::uuid, 'Tartar Sauce', 1::int, null::numeric, null::text, null::text, null::text),
  ('949b9dca-defb-4788-8c87-f90b5314f1b5'::uuid, 'Teriyaki Sauce', 1::int, null::numeric, null::text, null::text, null::text),
  ('886ca31c-98ae-409a-9f5b-3b842a41b6e1'::uuid, 'Truffle Sauce', 1::int, null::numeric, null::text, null::text, null::text),
  ('311428a0-5cd4-4ad9-a53d-623054ccbf7b'::uuid, 'Black Pepper', 1::int, null::numeric, null::text, null::text, null::text)
)
select
  v.list_name                                   as "Your list",
  (i.id is not null)                            as found,
  i.name                                        as "Name now",
  coalesce(v.new_name, i.name)                  as "Name after",
  i.uom                                         as "Unit now",
  coalesce(v.new_uom, i.uom)                    as "Unit after",
  v.min_order                                   as "Min order",
  case when v.pack_qty is null then ''
       else v.pack_qty || ' ' || v.pack_unit || ' / ' || coalesce(v.new_uom, i.uom)
  end                                           as "Contents"
from v
left join public.items i on i.id = v.id
order by v.min_order desc, v.list_name;
