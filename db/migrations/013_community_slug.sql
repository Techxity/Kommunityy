-- Gives every community a unique, readable slug so members/admins can sign
-- in at a bookmarkable, estate-specific URL (/l/{slug}) instead of only the
-- generic /login. Safe to re-run.

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs for any existing communities from their name, de-duplicated.
DO $$
DECLARE
  r RECORD;
  base_slug text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, name FROM public.communities WHERE slug IS NULL ORDER BY created_at ASC LOOP
    base_slug := lower(regexp_replace(regexp_replace(r.name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'));
    IF base_slug IS NULL OR base_slug = '' THEN
      base_slug := 'estate';
    END IF;
    candidate := base_slug;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.communities WHERE slug = candidate) LOOP
      n := n + 1;
      candidate := base_slug || '-' || n;
    END LOOP;
    UPDATE public.communities SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.communities ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS communities_slug_unique ON public.communities(slug);
