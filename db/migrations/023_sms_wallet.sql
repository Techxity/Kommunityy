-- SMS channel: a per-community prepaid wallet, fully separate from platform
-- fees and dues/donation payouts. See docs/sms-wallet-architecture.md.
-- All money columns are integer kobo (₦ × 100).

-- Per-community SMS settings (admin-owned toggle + per-channel switches).
CREATE TABLE IF NOT EXISTS public.community_sms_settings (
  community_id uuid PRIMARY KEY REFERENCES public.communities(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  sender_id text,
  route text NOT NULL DEFAULT 'dnd' CHECK (route IN ('dnd', 'generic')),
  ch_birthdays boolean NOT NULL DEFAULT false,
  ch_reminders boolean NOT NULL DEFAULT false,
  ch_broadcasts boolean NOT NULL DEFAULT false,
  low_balance_kobo bigint NOT NULL DEFAULT 50000,
  low_balance_alerted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cached wallet balance. Always equals SUM(sms_ledger.delta_kobo); the CHECK
-- makes an overdraw (debit larger than balance) roll its transaction back.
CREATE TABLE IF NOT EXISTS public.sms_wallets (
  community_id uuid PRIMARY KEY REFERENCES public.communities(id) ON DELETE CASCADE,
  balance_kobo bigint NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The source of truth: every credit (+) and debit (−) as an immutable row.
CREATE TABLE IF NOT EXISTS public.sms_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  delta_kobo bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('topup', 'debit', 'refund', 'adjustment')),
  reference text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_ledger_community_idx ON public.sms_ledger(community_id, created_at DESC);

-- Top-up payment audit (mirrors dues_payments). Kept in its own table so it is
-- never swept into payout/fee aggregation.
CREATE TABLE IF NOT EXISTS public.sms_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  amount_kobo bigint NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  provider text NOT NULL DEFAULT 'paystack',
  provider_ref text NOT NULL,
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);

-- Per-recipient send log.
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  msisdn text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('birthday', 'reminder', 'broadcast', 'test')),
  segments int NOT NULL,
  cost_kobo bigint NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered')),
  provider text NOT NULL DEFAULT 'termii',
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_messages_community_idx ON public.sms_messages(community_id, created_at DESC);

-- Member-level SMS opt-out (respected by every send path).
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS sms_opt_out boolean NOT NULL DEFAULT false;
