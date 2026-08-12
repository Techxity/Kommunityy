import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { errorBoundary } from "@/lib/error-boundary.server";
import { assertNotRateLimited, recordAttempt, clientIp } from "@/lib/auth/rate-limit.server";

// Where "Contact Us" submissions land.
const CONTACT_TO = "hello@akenrose.com";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Public: emails a contact-form submission to the team, with the sender's
// address as reply-to so a reply goes straight back to them. Rate-limited per
// IP so the form can't be used to spam.
export const submitContactMessage = createServerFn({ method: "POST" })
  .middleware([errorBoundary])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        message: z.string().min(1).max(5000),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const ip = clientIp();
    await assertNotRateLimited(`contact:${ip}`, 5, 60 * 60 * 1000);
    await recordAttempt(`contact:${ip}`);

    const html = `
      <p style="margin:0 0 12px;"><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
      <p style="margin:0;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
    `;
    const result = await sendEmail({
      to: CONTACT_TO,
      subject: `Kommunity contact — ${data.name}`,
      html,
      fromName: "Kommunity Contact",
      replyTo: data.email,
    });
    if (!result.ok) {
      throw new Error("We couldn't send your message right now. Please email us directly at hello@akenrose.com.");
    }
    return { ok: true };
  });
