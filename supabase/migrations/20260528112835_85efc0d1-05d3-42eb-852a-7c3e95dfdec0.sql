
-- 1. Subscription tiers
CREATE TABLE public.subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  platform_fee_pct numeric(5,2) NOT NULL DEFAULT 5.00,
  monthly_price_ngn numeric DEFAULT 0,
  monthly_price_usd numeric DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_tiers TO anon, authenticated;
GRANT ALL ON public.subscription_tiers TO service_role;

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers readable by all" ON public.subscription_tiers FOR SELECT USING (true);

INSERT INTO public.subscription_tiers (name, platform_fee_pct, monthly_price_ngn, monthly_price_usd, sort_order) VALUES
  ('Free', 7.00, 0, 0, 1),
  ('Pro', 3.50, 25000, 25, 2),
  ('Enterprise', 1.50, 150000, 150, 3);

-- 2. Communities: bank + recipient + tier
ALTER TABLE public.communities
  ADD COLUMN bank_name text,
  ADD COLUMN bank_code text,
  ADD COLUMN account_number text,
  ADD COLUMN account_name text,
  ADD COLUMN paystack_recipient_code text,
  ADD COLUMN tier_id uuid REFERENCES public.subscription_tiers(id);

-- default existing communities to Free tier
UPDATE public.communities SET tier_id = (SELECT id FROM public.subscription_tiers WHERE name='Free');

-- 3. Fee breakdown on payment tables
ALTER TABLE public.dues_payments
  ADD COLUMN paystack_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN platform_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN community_net numeric NOT NULL DEFAULT 0;

ALTER TABLE public.donation_payments
  ADD COLUMN paystack_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN platform_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN community_net numeric NOT NULL DEFAULT 0;

-- 4. Payouts
CREATE TYPE payout_status AS ENUM ('requested','approved','paid','failed','rejected');
CREATE TYPE payout_method AS ENUM ('paystack_transfer','manual');

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  currency payment_currency NOT NULL,
  status payout_status NOT NULL DEFAULT 'requested',
  method payout_method,
  paystack_transfer_code text,
  paystack_transfer_ref text,
  notes text,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payouts_community ON public.payouts(community_id, status);
CREATE INDEX idx_payouts_status ON public.payouts(status);

GRANT SELECT ON public.payouts TO anon, authenticated;
GRANT ALL ON public.payouts TO service_role;

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts readable by all" ON public.payouts FOR SELECT USING (true);

-- 5. Balance view
CREATE OR REPLACE VIEW public.community_balances
WITH (security_invoker = true) AS
WITH collected AS (
  SELECT dp.community_id, pay.currency, COALESCE(SUM(pay.community_net),0) AS amt
  FROM public.donation_payments pay
  JOIN public.donations dp ON dp.id = pay.donation_id
  WHERE pay.status = 'paid'
  GROUP BY dp.community_id, pay.currency
  UNION ALL
  SELECT dpl.community_id, dp.currency, COALESCE(SUM(dp.community_net),0)
  FROM public.dues_payments dp
  JOIN public.dues_plans dpl ON dpl.id = dp.plan_id
  WHERE dp.status = 'paid'
  GROUP BY dpl.community_id, dp.currency
),
collected_agg AS (
  SELECT community_id, currency, SUM(amt) AS collected
  FROM collected GROUP BY community_id, currency
),
paid_out AS (
  SELECT community_id, currency, COALESCE(SUM(amount),0) AS amt
  FROM public.payouts WHERE status = 'paid'
  GROUP BY community_id, currency
),
pending_out AS (
  SELECT community_id, currency, COALESCE(SUM(amount),0) AS amt
  FROM public.payouts WHERE status IN ('requested','approved')
  GROUP BY community_id, currency
)
SELECT
  c.id AS community_id,
  cur.currency,
  COALESCE(ca.collected, 0)  AS collected,
  COALESCE(po.amt, 0)        AS paid_out,
  COALESCE(pe.amt, 0)        AS pending_out,
  COALESCE(ca.collected,0) - COALESCE(po.amt,0) - COALESCE(pe.amt,0) AS available
FROM public.communities c
CROSS JOIN (VALUES ('NGN'::payment_currency), ('USD'::payment_currency)) AS cur(currency)
LEFT JOIN collected_agg ca ON ca.community_id = c.id AND ca.currency = cur.currency
LEFT JOIN paid_out po      ON po.community_id = c.id AND po.currency = cur.currency
LEFT JOIN pending_out pe   ON pe.community_id = c.id AND pe.currency = cur.currency;

GRANT SELECT ON public.community_balances TO anon, authenticated;
