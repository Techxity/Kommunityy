-- Real backing for birthday messages / broadcasts, and real login accounts
-- for approved members (invite-based: admin approves -> member gets an
-- emailed link to set a password). Safe to re-run.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS birthday_messages jsonb NOT NULL DEFAULT '{
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
  }'::jsonb;

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  reach int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broadcasts_community_id_idx ON public.broadcasts(community_id, sent_at DESC);

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_invites_member_id_idx ON public.member_invites(member_id);
