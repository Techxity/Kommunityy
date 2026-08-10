-- Paystack Subaccounts: lets each community be settled directly by
-- Paystack (on the platform's normal settlement schedule, T+1 once
-- approved) instead of the platform holding all collections and manually
-- transferring a share out later. Subaccounts are an NGN-rails feature —
-- USD dues/donations keep using the existing manual payout flow, same as
-- USD payouts already do today.
--
-- settlement_mode distinguishes charges that were split at Paystack's end
-- (money never touched the platform's balance, so it must NOT also be
-- counted toward the manual payout pool) from charges that landed fully in
-- the platform's balance the old way (still payable via the payouts table).
-- Getting this wrong in either direction either double-pays or under-pays
-- a community, so every read of community_balances_by_source needs to stay
-- scoped to 'platform_held' rows only.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text,
  ADD COLUMN IF NOT EXISTS subaccount_percentage_charge numeric(5,2);

ALTER TABLE public.dues_payments
  ADD COLUMN IF NOT EXISTS settlement_mode text NOT NULL DEFAULT 'platform_held'
    CHECK (settlement_mode IN ('platform_held', 'subaccount_split'));

ALTER TABLE public.donation_payments
  ADD COLUMN IF NOT EXISTS settlement_mode text NOT NULL DEFAULT 'platform_held'
    CHECK (settlement_mode IN ('platform_held', 'subaccount_split'));

-- community_balances_by_source must exclude subaccount-split charges from
-- "collected" — that money was never in the platform's balance to pay out.
CREATE OR REPLACE VIEW public.community_balances_by_source AS
WITH collected AS (
  SELECT dp.community_id, pay.currency, 'donations'::public.payout_source AS source,
         COALESCE(SUM(pay.community_net),0) AS amt
  FROM public.donation_payments pay
  JOIN public.donations dp ON dp.id = pay.donation_id
  WHERE pay.status = 'paid' AND pay.settlement_mode = 'platform_held'
  GROUP BY dp.community_id, pay.currency
  UNION ALL
  SELECT dpl.community_id, dp.currency, 'dues'::public.payout_source,
         COALESCE(SUM(dp.community_net),0)
  FROM public.dues_payments dp
  JOIN public.dues_plans dpl ON dpl.id = dp.plan_id
  WHERE dp.status = 'paid' AND dp.settlement_mode = 'platform_held'
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
CROSS JOIN (VALUES ('NGN'::public.payment_currency), ('USD'::public.payment_currency)) AS cur(currency)
CROSS JOIN (VALUES ('dues'::public.payout_source), ('donations'::public.payout_source)) AS src(source)
LEFT JOIN collected co
  ON co.community_id = c.id AND co.currency = cur.currency AND co.source = src.source
LEFT JOIN paid_out po
  ON po.community_id = c.id AND po.currency = cur.currency AND po.source = src.source
LEFT JOIN pending_out pe
  ON pe.community_id = c.id AND pe.currency = cur.currency AND pe.source = src.source;
