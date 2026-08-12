// Plain-JS mirror of src/lib/email-templates.ts, for the standalone cron
// scripts (they run outside the Vite/TS build, so they can't import a .ts
// module directly). Only the templates the cron scripts actually send are
// included here (birthday, trial reminder, trial ended) — keep this in sync
// with email-templates.ts if you change the look.

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shell({ accentColor, badge, heading, bodyHtml, ctaText, ctaUrl, footerNote }) {
  const cta =
    ctaText && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
          <tr>
            <td style="border-radius:999px;background-color:#111827;">
              <a href="${ctaUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${ctaText}</a>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">Or paste this link into your browser: ${ctaUrl}</p>
      `
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:${accentColor};padding:22px 32px;">
                <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.92);">${badge}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:21px;line-height:1.35;color:#111827;font-weight:700;">${heading}</h1>
                <div style="font-size:15px;line-height:1.65;color:#374151;">${bodyHtml}</div>
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:#fafafa;border-top:1px solid #f0f0f0;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${footerNote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function birthdayEmail({ memberName, communityName, message }) {
  const firstName = String(memberName).split(" ")[0];
  return shell({
    accentColor: "#f59e0b",
    badge: "🎂 Birthday wishes",
    heading: `Happy birthday, ${escapeHtml(firstName)}!`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Dear ${escapeHtml(memberName)},</p>
      <p style="margin:0;">${escapeHtml(message)}</p>
    `,
    footerNote: `Sent with care by ${escapeHtml(communityName)}, powered by Kommunity.`,
  });
}

// Sent once per community per day (only when there's at least one
// celebrant), to every community_admin on file. Gives the admin a
// copy-paste-ready message per celebrant so they can post it in their own
// WhatsApp group manually — the whole point being to avoid per-member sends
// through the paid Meta Business API.
export function celebrantsDigestEmail({ communityName, celebrants }) {
  const count = celebrants.length;
  const cards = celebrants
    .map(
      (c) => `
      <div style="margin:0 0 14px;padding:14px 16px;background-color:#fffbeb;border-radius:10px;">
        <p style="margin:0 0 6px;font-weight:700;color:#111827;">${escapeHtml(c.name)}</p>
        <p style="margin:0;color:#374151;white-space:pre-wrap;">${escapeHtml(c.message)}</p>
      </div>`,
    )
    .join("");
  return shell({
    accentColor: "#f59e0b",
    badge: "🎂 Today's celebrants",
    heading: count === 1 ? "1 member is celebrating today" : `${count} members are celebrating today`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Copy any of these straight into your WhatsApp group:</p>
      ${cards}
    `,
    footerNote: `Sent to the admins of ${escapeHtml(communityName)}. Sharing these yourself in your WhatsApp group costs nothing — that's why this exists instead of the app messaging each member directly.`,
  });
}

export function trialReminderEmail({ adminName, communityName, daysLeft, subscriptionUrl }) {
  return shell({
    accentColor: "#f59e0b",
    badge: "⏳ Trial reminder",
    heading: daysLeft === 1 ? `${escapeHtml(communityName)}'s trial ends tomorrow` : `${escapeHtml(communityName)}'s trial ends in 2 days`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(adminName)},</p>
      <p style="margin:0;">
        ${daysLeft === 1 ? "Just a heads up — your trial ends tomorrow." : "Your trial ends in 2 days."}
        Pick a plan before then to keep everything running without a gap. Nothing you've set up will be lost either way.
      </p>
    `,
    ...(subscriptionUrl ? { ctaText: "Choose a plan", ctaUrl: subscriptionUrl } : {}),
    footerNote: "You're receiving this because you're the admin of a community on Kommunity.",
  });
}

export function trialEndedEmail({ adminName, communityName, subscriptionUrl }) {
  return shell({
    accentColor: "#e11d48",
    badge: "⏸️ Trial ended",
    heading: `${escapeHtml(communityName)}'s trial has ended`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(adminName)},</p>
      <p style="margin:0;">We've paused <strong>${escapeHtml(communityName)}</strong> while you pick a plan. Nothing has been deleted — sign in and choose a plan any time to pick up right where you left off.</p>
    `,
    ...(subscriptionUrl ? { ctaText: "Choose a plan", ctaUrl: subscriptionUrl } : {}),
    footerNote: "You're receiving this because you're the admin of a community on Kommunity.",
  });
}
