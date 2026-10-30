-- Seeds the one super-admin account, since there's no self-serve signup for
-- that role. Safe to re-run: both inserts are no-ops if the account already
-- exists.
--
-- No password is seeded. 'disabled' is not a valid hash, so the account can't
-- sign in until its owner sets a password with "Forgot password" on /login
-- (the reset link goes to the email below). Never commit a password or a
-- hash of a known password here.

INSERT INTO public.users (email, password_hash, name)
VALUES ('techxityhub@gmail.com', 'disabled', 'Super Admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, community_id)
SELECT id, 'super_admin', NULL
FROM public.users
WHERE email = 'techxityhub@gmail.com'
ON CONFLICT (user_id, role, COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO NOTHING;
