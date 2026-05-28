-- Currency / provider enums
CREATE TYPE public.payment_currency AS ENUM ('NGN', 'USD');
CREATE TYPE public.payment_provider AS ENUM ('paystack', 'stripe');
CREATE TYPE public.dues_interval AS ENUM ('monthly', 'quarterly', 'yearly');
CREATE TYPE public.donation_status AS ENUM ('active', 'closed');
CREATE TYPE public.payment_status AS ENUM ('paid', 'failed', 'refunded', 'pending');

-- Communities (one row for now; multi-tenant later)
CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency public.payment_currency NOT NULL DEFAULT 'NGN',
  provider public.payment_provider NOT NULL DEFAULT 'paystack',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.communities TO anon, authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "communities readable by all" ON public.communities FOR SELECT TO anon, authenticated USING (true);

-- Dues plans
CREATE TABLE public.dues_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency public.payment_currency NOT NULL,
  interval public.dues_interval NOT NULL,
  stripe_price_id TEXT,
  paystack_plan_code TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dues_plans TO anon, authenticated;
GRANT ALL ON public.dues_plans TO service_role;
ALTER TABLE public.dues_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dues_plans readable by all" ON public.dues_plans FOR SELECT TO anon, authenticated USING (true);

-- Dues payments
CREATE TABLE public.dues_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.dues_plans(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  member_email TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency public.payment_currency NOT NULL,
  provider public.payment_provider NOT NULL,
  provider_ref TEXT NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'paid',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);

GRANT SELECT ON public.dues_payments TO anon, authenticated;
GRANT ALL ON public.dues_payments TO service_role;
ALTER TABLE public.dues_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dues_payments readable by all" ON public.dues_payments FOR SELECT TO anon, authenticated USING (true);

-- Donations (campaigns)
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  target NUMERIC(12,2) NOT NULL CHECK (target > 0),
  currency public.payment_currency NOT NULL,
  deadline DATE,
  status public.donation_status NOT NULL DEFAULT 'active',
  shareable_slug TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT,
  paystack_page_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.donations TO anon, authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "donations readable by all" ON public.donations FOR SELECT TO anon, authenticated USING (true);

-- Donation payments
CREATE TABLE public.donation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  payer_name TEXT NOT NULL,
  payer_email TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency public.payment_currency NOT NULL,
  provider public.payment_provider NOT NULL,
  provider_ref TEXT NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'paid',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);

GRANT SELECT ON public.donation_payments TO anon, authenticated;
GRANT ALL ON public.donation_payments TO service_role;
ALTER TABLE public.donation_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "donation_payments readable by all" ON public.donation_payments FOR SELECT TO anon, authenticated USING (true);

-- Helpful indexes
CREATE INDEX donation_payments_donation_id_idx ON public.donation_payments(donation_id);
CREATE INDEX dues_payments_plan_id_idx ON public.dues_payments(plan_id);
CREATE INDEX donations_community_id_idx ON public.donations(community_id);
CREATE INDEX dues_plans_community_id_idx ON public.dues_plans(community_id);

-- Computed totals view for donations
CREATE OR REPLACE VIEW public.donation_totals AS
SELECT
  d.id AS donation_id,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS collected,
  COUNT(p.id) FILTER (WHERE p.status = 'paid') AS payer_count
FROM public.donations d
LEFT JOIN public.donation_payments p ON p.donation_id = d.id
GROUP BY d.id;

GRANT SELECT ON public.donation_totals TO anon, authenticated;

-- Seed one community so the app has somewhere to write to
INSERT INTO public.communities (name, currency, provider)
VALUES ('Default Community', 'NGN', 'paystack');
