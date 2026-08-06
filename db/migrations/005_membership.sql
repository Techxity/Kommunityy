-- Real backing for the member onboarding/join-form feature: the admin form
-- builder, the public join page, chapters, and pending-member approvals
-- were all local, per-browser prototype state before this — nothing
-- persisted, and nothing was shared between an applicant's browser and the
-- admin's. Safe to re-run.

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS onboarding_fields jsonb NOT NULL
    DEFAULT '["Name","Email","Phone number","WhatsApp Number","Chapter","Date of Birth"]'::jsonb;

CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  region text,
  coordinator text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chapters_community_id_idx ON public.chapters(community_id);

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
  -- Free-text/extended onboarding fields that don't have a dedicated column
  -- (Year of Graduation, Matriculation number, Who invited you?, etc).
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS members_community_id_idx ON public.members(community_id);
CREATE INDEX IF NOT EXISTS members_status_idx ON public.members(community_id, status);
