-- Seeds the one super-admin account, since there's no self-serve signup for
-- that role. Safe to re-run: both inserts are no-ops if the account already
-- exists.
--
-- email:    techxityhub@gmail.com
-- password: @HV%BfMyNpDnfsvUp2AT
-- (hash below is PBKDF2-SHA256/100k iterations of the password above, in
-- the pbkdf2$<iterations>$<saltB64>$<hashB64> format used by
-- src/lib/auth/password.ts)

INSERT INTO public.users (email, password_hash, name)
VALUES (
  'techxityhub@gmail.com',
  'pbkdf2$100000$ashF3k1lW8YwaqFKy1fxew==$9szZWEraWrBXKpJiOJrlQSmf4mQ33adDcUuXnCIP10k=',
  'Super Admin'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, community_id)
SELECT id, 'super_admin', NULL
FROM public.users
WHERE email = 'techxityhub@gmail.com'
ON CONFLICT (user_id, role, COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO NOTHING;
