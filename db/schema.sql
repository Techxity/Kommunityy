-- Kommunityy — Neon Postgres schema
--
-- Full schema: tables, views, and helper functions for both the app data
-- (communities/dues/donations/payouts) and authentication (users/sessions).
-- There is no Supabase anywhere — auth lives in this database too.
--   * No ROW LEVEL SECURITY and no GRANT statements. Authorization is done
--     in application code (see src/lib/payments/authz.ts and
--     src/lib/auth/require-auth.ts) before any query runs. Every query goes
--     through a trusted server-side connection.
--   * No seed data. The database starts completely empty — see
--     db/migrations/002_auth.sql and the seed snippet in the same folder
--     for creating the first (super admin) account.
--
-- Apply once against a fresh Neon database, e.g.:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- If you already ran an earlier version of this file against a live
-- database, don't re-run the whole thing — apply db/migrations/002_auth.sql
-- instead, which only adds what's new (users/sessions/login_attempts + FKs).

-- ── Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.payment_currency AS ENUM ('NGN', 'USD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('paystack', 'stripe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.dues_interval AS ENUM ('monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.donation_status AS ENUM ('active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('paid', 'failed', 'refunded', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payout_status AS ENUM ('requested', 'approved', 'paid', 'failed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payout_method AS ENUM ('paystack_transfer', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payout_source AS ENUM ('dues', 'donations');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'community_admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Auth: users & sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions(expires_at);

-- Rate limiting for login attempts (per email or per IP — see auth.functions.ts).
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_identifier_idx ON public.login_attempts(identifier, attempted_at);

-- ── Subscription tiers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  platform_fee_pct numeric(5,2) NOT NULL DEFAULT 5.00,
  monthly_price_ngn numeric DEFAULT 0,
  monthly_price_usd numeric DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Communities ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accept_ngn boolean NOT NULL DEFAULT true,
  accept_usd boolean NOT NULL DEFAULT true,
  bank_name text,
  bank_code text,
  account_number text,
  account_name text,
  paystack_recipient_code text,
  tier_id uuid REFERENCES public.subscription_tiers(id),
  trial_ends_at timestamptz,
  onboarding_fields jsonb NOT NULL
    DEFAULT '["Name","Email","Phone number","WhatsApp Number","Chapter","Date of Birth"]'::jsonb,
  birthday_messages jsonb NOT NULL DEFAULT '{
    "January": "Wishing you a year of new beginnings and abundant blessings 🎉",
    "February": "May your day be as warm as the love we share as a community ❤️",
    "March": "Happy birthday! May this year bloom with grace and joy.",
    "April": "Celebrating you today and always — happy birthday!",
    "May": "May this new year of yours overflow with peace and laughter.",
    "June": "Sunshine on your day — happy birthday from all of us!",
    "July": "Wishing you health, wealth and many more years 🎂",
    "August": "Cheers to you on your special day — keep shining!",
    "September": "Happy birthday! May every dream you carry come alive.",
    "October": "May the year ahead be your most beautiful chapter yet.",
    "November": "Grateful to have you in our community — happy birthday!",
    "December": "Ending the year celebrating you. Happy birthday!"
  }'::jsonb,
  election_roles jsonb NOT NULL
    DEFAULT '["President","Secretary","Treasurer","PRO","Welfare Officer"]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  reach int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broadcasts_community_id_idx ON public.broadcasts(community_id, sent_at DESC);

-- ── Chapters ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  region text,
  coordinator text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chapters_community_id_idx ON public.chapters(community_id);

-- ── Members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  whatsapp text,
  dob date,
  country text,
  address text,
  role text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'rejected')),
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS members_community_id_idx ON public.members(community_id);
CREATE INDEX IF NOT EXISTS members_status_idx ON public.members(community_id, status);

CREATE TABLE IF NOT EXISTS public.member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_invites_member_id_idx ON public.member_invites(member_id);

-- ── Elections ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.elections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  year int NOT NULL,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  ends_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS elections_community_id_idx ON public.elections(community_id, year DESC);

CREATE TABLE IF NOT EXISTS public.election_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  role text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS election_positions_election_id_idx ON public.election_positions(election_id);

CREATE TABLE IF NOT EXISTS public.election_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.election_positions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS election_candidates_position_id_idx ON public.election_candidates(position_id);

CREATE TABLE IF NOT EXISTS public.election_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.election_positions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  voter_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, voter_member_id)
);
CREATE INDEX IF NOT EXISTS election_votes_candidate_id_idx ON public.election_votes(candidate_id);

-- ── Dues plans ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dues_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  interval public.dues_interval NOT NULL,
  stripe_price_id TEXT,
  paystack_plan_code TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_ngn numeric,
  amount_usd numeric,
  name text NOT NULL DEFAULT 'Membership dues'
);

-- ── Dues payments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dues_payments (
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
  paystack_fee numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  community_net numeric NOT NULL DEFAULT 0,
  UNIQUE (provider, provider_ref)
);

-- ── Donations (campaigns) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  deadline DATE,
  status public.donation_status NOT NULL DEFAULT 'active',
  shareable_slug TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT,
  paystack_page_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_ngn numeric,
  target_usd numeric
);

-- ── Donation payments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.donation_payments (
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
  paystack_fee numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  community_net numeric NOT NULL DEFAULT 0,
  UNIQUE (provider, provider_ref)
);

-- ── Payouts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  currency public.payment_currency NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'requested',
  method public.payout_method,
  paystack_transfer_code text,
  paystack_transfer_ref text,
  source public.payout_source NOT NULL,
  notes text,
  requested_by uuid REFERENCES public.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Roles (super_admin / community_admin / member) ─────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique ON public.user_roles
  (user_id, role, COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS donation_payments_donation_id_idx ON public.donation_payments(donation_id);
CREATE INDEX IF NOT EXISTS dues_payments_plan_id_idx ON public.dues_payments(plan_id);
CREATE INDEX IF NOT EXISTS donations_community_id_idx ON public.donations(community_id);
CREATE INDEX IF NOT EXISTS dues_plans_community_id_idx ON public.dues_plans(community_id);
CREATE INDEX IF NOT EXISTS idx_payouts_community ON public.payouts(community_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);

-- ── Helper functions (app-level authorization) ─────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin(_user_id uuid, _community_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'super_admin'
           OR (role = 'community_admin' AND community_id = _community_id))
  )
$$;

-- ── Views ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.donation_totals AS
SELECT
  d.id AS donation_id,
  COALESCE(SUM(CASE WHEN dp.currency = 'NGN' AND dp.status = 'paid' THEN dp.amount END), 0) AS collected_ngn,
  COALESCE(SUM(CASE WHEN dp.currency = 'USD' AND dp.status = 'paid' THEN dp.amount END), 0) AS collected_usd,
  COUNT(DISTINCT CASE WHEN dp.status = 'paid' THEN dp.id END) AS payer_count
FROM public.donations d
LEFT JOIN public.donation_payments dp ON dp.donation_id = d.id
GROUP BY d.id;

CREATE OR REPLACE VIEW public.community_balances_by_source AS
WITH collected AS (
  SELECT dp.community_id, pay.currency, 'donations'::public.payout_source AS source,
         COALESCE(SUM(pay.community_net),0) AS amt
  FROM public.donation_payments pay
  JOIN public.donations dp ON dp.id = pay.donation_id
  WHERE pay.status = 'paid'
  GROUP BY dp.community_id, pay.currency
  UNION ALL
  SELECT dpl.community_id, dp.currency, 'dues'::public.payout_source,
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
CROSS JOIN (VALUES ('NGN'::public.payment_currency), ('USD'::public.payment_currency)) AS cur(currency)
CROSS JOIN (VALUES ('dues'::public.payout_source), ('donations'::public.payout_source)) AS src(source)
LEFT JOIN collected co
  ON co.community_id = c.id AND co.currency = cur.currency AND co.source = src.source
LEFT JOIN paid_out po
  ON po.community_id = c.id AND po.currency = cur.currency AND po.source = src.source
LEFT JOIN pending_out pe
  ON pe.community_id = c.id AND pe.currency = cur.currency AND pe.source = src.source;

-- No seed data — the database starts empty on purpose.
