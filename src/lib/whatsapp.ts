// Thin wrapper around Meta's WhatsApp Cloud API (Graph API) — sends approved
// template messages over plain fetch, mirroring src/lib/email.ts. Only ever
// called from inside createServerFn() handlers, never imported by client code.
//
// Why a template and not free text: WhatsApp Cloud API only allows
// business-initiated messages (i.e. your app messaging someone who hasn't
// just messaged you) through a pre-approved message *template* — you can't
// send arbitrary HTML/text like with email. One shared template covers every
// community, the same way one Resend sender address covers every community,
// with a parameter carrying the community's name so recipients still see
// who it's from.
//
// One-time setup (outside this codebase, all in Meta's dashboards):
//   1. Create a Meta Business App with the WhatsApp product added:
//      business.facebook.com -> your app -> WhatsApp -> API Setup.
//   2. Note the Phone Number ID shown there, and generate a permanent
//      access token (Business Settings -> System Users -> a system user with
//      whatsapp_business_messaging permission -> not the 24h test token).
//   3. In WhatsApp Manager -> Message Templates, create a Utility-category
//      template named to match WHATSAPP_TEMPLATE_NAME (default
//      "birthday_wish") with exactly this body, then wait for Meta's
//      approval (usually minutes to a few hours):
//
//        Happy Birthday, {{1}}! 🎉
//
//        {{2}}
//
//        With love, {{3}}
//
//   4. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your
//      environment. Optionally WHATSAPP_TEMPLATE_NAME / WHATSAPP_TEMPLATE_LANG
//      if you name or localize the template differently (defaults:
//      "birthday_wish" / "en").
//
// Until both env vars are set, isWhatsAppConfigured() returns false and
// callers skip WhatsApp entirely — no error, no noise, birthday emails keep
// working exactly as before. Once configured, an unapproved/misnamed
// template still fails gracefully per-recipient (email still goes out).
function resolveConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    template: process.env.WHATSAPP_TEMPLATE_NAME || "birthday_wish",
    lang: process.env.WHATSAPP_TEMPLATE_LANG || "en",
  };
}

export function isWhatsAppConfigured(): boolean {
  const { token, phoneNumberId } = resolveConfig();
  return Boolean(token && phoneNumberId);
}

// Normalizes a stored WhatsApp number to the digits-only, country-code-first
// format Meta's API requires — e.g. "+234 803 123 4567" or
// "0803 123 4567" both need to become "2348031234567". We can't safely guess
// a country code for a bare local number, so those are rejected rather than
// silently mis-dialed.
function normalizeNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (raw.trim().startsWith("+")) return digits;
  // Already looks like it includes a country code (11+ digits with no `+`).
  if (digits.length > 11) return digits;
  return null;
}

export async function sendWhatsAppTemplate({
  to,
  firstName,
  message,
  communityName,
}: {
  to: string;
  firstName: string;
  message: string;
  communityName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { token, phoneNumberId, template, lang } = resolveConfig();
  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp isn't configured — add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID." };
  }
  const number = normalizeNumber(to);
  if (!number) {
    return { ok: false, error: "WhatsApp number is missing a country code — include it (e.g. +234...)." };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: number,
        type: "template",
        template: {
          name: template,
          language: { code: lang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: firstName },
                { type: "text", text: message },
                { type: "text", text: communityName },
              ],
            },
          ],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error sending WhatsApp message." };
  }
}
