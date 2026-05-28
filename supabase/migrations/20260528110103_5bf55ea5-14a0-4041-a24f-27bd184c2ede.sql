DROP VIEW IF EXISTS public.donation_totals;

CREATE VIEW public.donation_totals
WITH (security_invoker = true)
AS
SELECT
  d.id AS donation_id,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS collected,
  COUNT(p.id) FILTER (WHERE p.status = 'paid') AS payer_count
FROM public.donations d
LEFT JOIN public.donation_payments p ON p.donation_id = d.id
GROUP BY d.id;

GRANT SELECT ON public.donation_totals TO anon, authenticated;
