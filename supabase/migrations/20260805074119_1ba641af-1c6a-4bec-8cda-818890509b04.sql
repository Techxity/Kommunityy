
-- 1. Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'community_admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique ON public.user_roles (user_id, role, COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin(_user_id uuid, _community_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'super_admin'
           OR (role = 'community_admin' AND community_id = _community_id))
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_community_admin(uuid, uuid) TO authenticated, service_role;

-- 2. communities: hide bank/payout columns from clients
DROP POLICY IF EXISTS "communities readable by all" ON public.communities;
CREATE POLICY "communities public info readable" ON public.communities
  FOR SELECT TO anon, authenticated USING (true);

REVOKE SELECT ON public.communities FROM anon, authenticated;
GRANT SELECT (id, name, created_at, updated_at, accept_ngn, accept_usd, tier_id)
  ON public.communities TO anon, authenticated;
GRANT ALL ON public.communities TO service_role;

-- 3. donations: public share pages, but hide provider identifiers
DROP POLICY IF EXISTS "donations readable by all" ON public.donations;
CREATE POLICY "donations public readable" ON public.donations
  FOR SELECT TO anon, authenticated USING (true);

REVOKE SELECT ON public.donations FROM anon, authenticated;
GRANT SELECT (id, community_id, purpose, deadline, status, shareable_slug, created_at, updated_at, target_ngn, target_usd)
  ON public.donations TO anon, authenticated;
GRANT ALL ON public.donations TO service_role;

-- 4. dues_plans: public checkout pages, hide provider identifiers
DROP POLICY IF EXISTS "dues_plans readable by all" ON public.dues_plans;
CREATE POLICY "dues_plans public readable" ON public.dues_plans
  FOR SELECT TO anon, authenticated USING (true);

REVOKE SELECT ON public.dues_plans FROM anon, authenticated;
GRANT SELECT (id, community_id, interval, active, created_at, amount_ngn, amount_usd, name)
  ON public.dues_plans TO anon, authenticated;
GRANT ALL ON public.dues_plans TO service_role;

-- 5. donation_payments: admins only
DROP POLICY IF EXISTS "donation_payments readable by all" ON public.donation_payments;
CREATE POLICY "donation_payments admin readable" ON public.donation_payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.donations d
      WHERE d.id = donation_payments.donation_id
        AND public.is_community_admin(auth.uid(), d.community_id)
    )
  );
REVOKE SELECT ON public.donation_payments FROM anon;
GRANT SELECT ON public.donation_payments TO authenticated;
GRANT ALL ON public.donation_payments TO service_role;

-- 6. dues_payments: admins only
DROP POLICY IF EXISTS "dues_payments readable by all" ON public.dues_payments;
CREATE POLICY "dues_payments admin readable" ON public.dues_payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.dues_plans p
      WHERE p.id = dues_payments.plan_id
        AND public.is_community_admin(auth.uid(), p.community_id)
    )
  );
REVOKE SELECT ON public.dues_payments FROM anon;
GRANT SELECT ON public.dues_payments TO authenticated;
GRANT ALL ON public.dues_payments TO service_role;

-- 7. payouts: admins only
DROP POLICY IF EXISTS "payouts readable by all" ON public.payouts;
CREATE POLICY "payouts admin readable" ON public.payouts
  FOR SELECT TO authenticated USING (public.is_community_admin(auth.uid(), community_id));
REVOKE SELECT ON public.payouts FROM anon;
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;

-- 8. Views: donation totals stay public (aggregates only); balances follow RLS
GRANT SELECT ON public.donation_totals TO anon, authenticated, service_role;
ALTER VIEW public.community_balances_by_source SET (security_invoker = on);
REVOKE SELECT ON public.community_balances_by_source FROM anon;
GRANT SELECT ON public.community_balances_by_source TO authenticated, service_role;
