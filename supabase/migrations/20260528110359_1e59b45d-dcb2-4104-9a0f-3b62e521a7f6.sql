
-- Communities: accept flags instead of single currency
ALTER TABLE public.communities DROP COLUMN IF EXISTS currency;
ALTER TABLE public.communities DROP COLUMN IF EXISTS provider;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS accept_ngn boolean NOT NULL DEFAULT true;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS accept_usd boolean NOT NULL DEFAULT true;

-- Dues plans: per-currency amounts
ALTER TABLE public.dues_plans DROP COLUMN IF EXISTS amount;
ALTER TABLE public.dues_plans DROP COLUMN IF EXISTS currency;
ALTER TABLE public.dues_plans ADD COLUMN IF NOT EXISTS amount_ngn numeric;
ALTER TABLE public.dues_plans ADD COLUMN IF NOT EXISTS amount_usd numeric;
ALTER TABLE public.dues_plans ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Membership dues';

-- Donations: per-currency targets
ALTER TABLE public.donations DROP COLUMN IF EXISTS target;
ALTER TABLE public.donations DROP COLUMN IF EXISTS currency;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS target_ngn numeric;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS target_usd numeric;

-- Refresh donation_totals view to expose per-currency totals
DROP VIEW IF EXISTS public.donation_totals;
CREATE VIEW public.donation_totals
WITH (security_invoker = true)
AS
SELECT
  d.id AS donation_id,
  COALESCE(SUM(CASE WHEN dp.currency = 'NGN' AND dp.status = 'paid' THEN dp.amount END), 0) AS collected_ngn,
  COALESCE(SUM(CASE WHEN dp.currency = 'USD' AND dp.status = 'paid' THEN dp.amount END), 0) AS collected_usd,
  COUNT(DISTINCT CASE WHEN dp.status = 'paid' THEN dp.id END) AS payer_count
FROM public.donations d
LEFT JOIN public.donation_payments dp ON dp.donation_id = d.id
GROUP BY d.id;

GRANT SELECT ON public.donation_totals TO anon, authenticated;
