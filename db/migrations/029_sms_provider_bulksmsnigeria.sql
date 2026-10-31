-- SMS moved from Termii to BulkSMSNigeria. New sms_messages rows record the
-- new provider; existing 'termii' rows are kept as history.
ALTER TABLE public.sms_messages ALTER COLUMN provider SET DEFAULT 'bulksmsnigeria';

-- The delivery-report webhook (/api/public/sms-dlr) looks rows up by the
-- provider's message id on every callback.
CREATE INDEX IF NOT EXISTS sms_messages_provider_message_id_idx
  ON public.sms_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
