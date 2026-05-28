
DO $$ BEGIN
  CREATE TYPE payout_source AS ENUM ('dues','donations');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS source payout_source NOT NULL DEFAULT 'dues';

ALTER TABLE public.payouts ALTER COLUMN source DROP DEFAULT;

CREATE OR REPLACE VIEW public.community_balances_by_source
WITH (security_invoker = true) AS
WITH collected AS (
  SELECT dp.community_id, pay.currency, 'donations'::payout_source AS source,
         COALESCE(SUM(pay.community_net),0) AS amt
  FROM public.donation_payments pay
  JOIN public.donations dp ON dp.id = pay.donation_id
  WHERE pay.status = 'paid'
  GROUP BY dp.community_id, pay.currency
  UNION ALL
  SELECT dpl.community_id, dp.currency, 'dues'::payout_source,
         COALESCE(SUM(dp.community_net),0)
  FROM public.dues_payments dp
  JOIN public.dues_plans dpl ON dpl.id = dp.plan_id
  WHERE dp.status = 'paid'
  GROUP BY dpl.community_id, dp.currency
),
paid_out AS (
  SELECT community_id, currency, source, COALESCE(SUM(amount),0) AS amt
  FROM public.payouts WHERE status = 'paid'
  GROUP BY community_id, currency, source
),
pending_out AS (
  SELECT community_id, currency, source, COALESCE(SUM(amount),0) AS amt
  FROM public.payouts WHERE status IN ('requested','approved')
  GROUP BY community_id, currency, source
)
SELECT
  c.id AS community_id,
  cur.currency,
  src.source,
  COALESCE(co.amt, 0) AS collected,
  COALESCE(po.amt, 0) AS paid_out,
  COALESCE(pe.amt, 0) AS pending_out,
  COALESCE(co.amt,0) - COALESCE(po.amt,0) - COALESCE(pe.amt,0) AS available
FROM public.communities c
CROSS JOIN (VALUES ('NGN'::payment_currency), ('USD'::payment_currency)) AS cur(currency)
CROSS JOIN (VALUES ('dues'::payout_source), ('donations'::payout_source)) AS src(source)
LEFT JOIN collected co
  ON co.community_id = c.id AND co.currency = cur.currency AND co.source = src.source
LEFT JOIN paid_out po
  ON po.community_id = c.id AND po.currency = cur.currency AND po.source = src.source
LEFT JOIN pending_out pe
  ON pe.community_id = c.id AND pe.currency = cur.currency AND pe.source = src.source;

GRANT SELECT ON public.community_balances_by_source TO anon, authenticated;
