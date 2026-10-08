-- =====================================================================
-- Link the FIRST Super Admin account. Run ONCE, after migration 004,
-- and after creating the login in Supabase > Authentication > Users.
--
-- The login email must be:  <username>@ckstore.local
-- e.g. username "homura"  →  homura@ckstore.local
--
-- Change 'homura' / 'Homura' below if you chose a different username.
-- Every other account is created inside the app (Manager > Users).
-- =====================================================================

insert into public.app_users (id, username, display_name, role)
select id, 'homura', 'Homura', 'super_admin'
from auth.users
where email = 'homura@ckstore.local'
on conflict (id) do nothing;

-- Should return exactly 1 row with role = super_admin:
select username, display_name, role, is_active from public.app_users;
