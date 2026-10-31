-- Gender as a first-class member field (onboarding form, admin roster,
-- member profile). Nullable — blank means the member didn't provide it.
-- Safe to re-run.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_gender_check'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_gender_check CHECK (gender IS NULL OR gender IN ('Male', 'Female'));
  END IF;
END $$;
