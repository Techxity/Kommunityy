// Thin wrapper around Resend's HTTP API (works over plain fetch, so it
// runs fine on Cloudflare Workers — no SDK needed). Only ever called from
// inside createServerFn() handlers, never imported by client code.
//
// Multi-tenant sender branding: Resend only lets you send from an address on
// a domain you've verified (resend.com/domains) — communities can't each
// verify their own domain, so every email still goes out from the same
// address (RESEND_FROM_ADDRESS, on our verified domain). What CAN vary per
// community is the display name in front of that address, e.g.
// `"Irewole Estate" <notifications@yourdomain.com>` — pass `fromName` to set
// it. Recipients see the community's name as the sender, not "Kommunity".
function resolveFromAddress(): string {
  const explicit = process.env.RESEND_FROM_ADDRESS;
  if (explicit) return explicit;
  // Back-compat: pull the bare address out of the older "Name <email>" env var.
  const legacy = process.env.RESEND_FROM_EMAIL;
  const match = legacy?.match(/<([^>]+)>/);
  return match?.[1] ?? legacy ?? "onboarding@resend.dev";
}

export async function sendEmail({
  to,
  subject,
  html,
  fromName,
  replyTo,
  cc,
}: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
  cc?: string | string[];
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY isn't set — add one from resend.com to your environment." };
  }
  const address = resolveFromAddress();
  const from = `${fromName ?? "Kommunity"} <${address}>`;
  // Drop any cc address that's identical to the recipient — Resend accepts
  // duplicates fine, but there's no reason to double-send to the same inbox
  // (e.g. a community admin emailing themselves their own birthday).
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).filter((c) => c && c.toLowerCase() !== to.toLowerCase()) : [];

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(ccList.length > 0 ? { cc: ccList } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error sending email." };
  }
}

export type BatchEmail = {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
  // Optional caller-supplied id (e.g. a member id) echoed back in `okIds` for
  // messages whose batch was accepted — lets callers mark exactly who was sent.
  id?: string;
};

// Bulk send via Resend's batch endpoint. Instead of one HTTP request per
// recipient — which for a large community means hundreds of concurrent calls
// that blow past Resend's rate limits and stall the request — this sends up
// to 100 messages per call and runs only a few of those calls at a time.
// Each message can have its own subject/html (batch entries are independent).
// Returns aggregate counts; a failed batch call counts its whole chunk as
// failed (Resend batch is accepted or rejected as a unit).
const BATCH_SIZE = 100; // Resend hard cap per /emails/batch call
const BATCH_CONCURRENCY = 3; // cap parallel batch calls to stay within rate limits

export async function sendEmailsBatch(
  messages: BatchEmail[],
): Promise<{ sent: number; failed: number; okIds: string[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, failed: messages.length, okIds: [] };
  if (messages.length === 0) return { sent: 0, failed: 0, okIds: [] };
  const address = resolveFromAddress();

  const chunks: BatchEmail[][] = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) chunks.push(messages.slice(i, i + BATCH_SIZE));

  let sent = 0;
  let failed = 0;
  const okIds: string[] = [];
  for (let i = 0; i < chunks.length; i += BATCH_CONCURRENCY) {
    const group = chunks.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(
      group.map(async (chunk) => {
        const body = chunk.map((m) => ({
          from: `${m.fromName ?? "Kommunity"} <${address}>`,
          to: [m.to],
          subject: m.subject,
          html: m.html,
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        }));
        try {
          const res = await fetch("https://api.resend.com/emails/batch", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.error(`[email batch] ${res.status}: ${detail}`);
            return { ok: 0, bad: chunk.length, ids: [] as string[] };
          }
          // Batch accepted as a unit — every message in it counts as sent.
          return { ok: chunk.length, bad: 0, ids: chunk.map((m) => m.id).filter((x): x is string => !!x) };
        } catch (e: any) {
          console.error(`[email batch] ${e?.message ?? "send failed"}`);
          return { ok: 0, bad: chunk.length, ids: [] as string[] };
        }
      }),
    );
    for (const r of results) {
      sent += r.ok;
      failed += r.bad;
      okIds.push(...r.ids);
    }
  }
  return { sent, failed, okIds };
}
