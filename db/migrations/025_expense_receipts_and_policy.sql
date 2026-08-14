-- Optional receipt/evidence per expense (stored inline as base64 — receipts are
-- small images/PDFs and this keeps it self-contained, no external blob store).
ALTER TABLE public.community_expenses
  ADD COLUMN IF NOT EXISTS receipt_base64 text,
  ADD COLUMN IF NOT EXISTS receipt_mime text,
  ADD COLUMN IF NOT EXISTS receipt_name text;

-- Admin-controlled policy: whether recorded expenses reduce the all-time
-- "funds position" (currently-held) figure in the financial report. Off by
-- default so behaviour is unchanged until an admin opts in.
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS expenses_reduce_held boolean NOT NULL DEFAULT false;
