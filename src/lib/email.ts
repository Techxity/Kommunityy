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
// it. Recipients see the community's name as the sender, not "Kinfolk".
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
  const from = `${fromName ?? "Kinfolk"} <${address}>`;
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
