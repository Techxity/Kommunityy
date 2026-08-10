// Shared HTML shell + per-notification designs for every email Kinfolk
// sends. Deliberately table-based with inline styles throughout — Outlook,
// Gmail's app, and most other email clients don't reliably support
// flexbox/grid or a `<style>` block, so neither is used here.
//
// This file only builds markup — it doesn't send anything. Live sends call
// sendEmail() from ./email with the html these functions return. The two
// standalone cron scripts (scripts/send-birthday-emails.mjs,
// scripts/trial-lifecycle.mjs) can't import a .ts module directly, so they
// use a plain-JS mirror at scripts/lib/email-templates.mjs — keep both in
// sync if you change the look here.

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shell({
  accentColor,
  badge,
  heading,
  bodyHtml,
  ctaText,
  ctaUrl,
  footerNote,
}: {
  accentColor: string;
  badge: string;
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote: string;
}): string {
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

export function birthdayEmail({
  memberName,
  communityName,
  message,
}: {
  memberName: string;
  communityName: string;
  message: string;
}): string {
  const firstName = memberName.split(" ")[0];
  return shell({
    accentColor: "#f59e0b",
    badge: "🎂 Birthday wishes",
    heading: `Happy birthday, ${firstName}!`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Dear ${escapeHtml(memberName)},</p>
      <p style="margin:0;">${escapeHtml(message)}</p>
    `,
    footerNote: `Sent with care by ${escapeHtml(communityName)}, powered by Kinfolk.`,
  });
}

export function broadcastEmail({
  communityName,
  bodyText,
}: {
  communityName: string;
  bodyText: string;
}): string {
  return shell({
    accentColor: "#4f46e5",
    badge: "📣 Community update",
    heading: `A message from ${communityName}`,
    bodyHtml: `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(bodyText)}</p>`,
    footerNote: `You're receiving this because you're an active member of ${escapeHtml(communityName)}.`,
  });
}

export function joinInviteEmail({
  communityName,
  joinUrl,
}: {
  communityName: string;
  joinUrl: string;
}): string {
  return shell({
    accentColor: "#0ea5e9",
    badge: "✉️ You're invited",
    heading: `${communityName} invited you to join`,
    bodyHtml: `<p style="margin:0;">Fill out a short form to apply — your community admin will review it and get you set up with a member account.</p>`,
    ctaText: "Fill out the join form",
    ctaUrl: joinUrl,
    footerNote: `This invite was sent by ${escapeHtml(communityName)} via Kinfolk.`,
  });
}

export function memberAccountReadyEmail({
  memberName,
  communityName,
  setupUrl,
}: {
  memberName: string;
  communityName: string;
  setupUrl: string;
}): string {
  return shell({
    accentColor: "#16a34a",
    badge: "✅ Membership approved",
    heading: `You're in, ${memberName.split(" ")[0]}!`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Your membership at <strong>${escapeHtml(communityName)}</strong> has been approved. Set a password to access your member portal.</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">This link expires in 7 days.</p>
    `,
    ctaText: "Set your password",
    ctaUrl: setupUrl,
    footerNote: `Sent by ${escapeHtml(communityName)} via Kinfolk.`,
  });
}

export function callTreePairingEmail({
  memberName,
  communityName,
  partnerNames,
  feedbackUrl,
}: {
  memberName: string;
  communityName: string;
  partnerNames: string[];
  feedbackUrl: string;
}): string {
  const partnerList = partnerNames.map((n) => escapeHtml(n)).join(" and ");
  return shell({
    accentColor: "#0891b2",
    badge: "📞 Call tree",
    heading: `You're paired with ${partnerList}`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(memberName.split(" ")[0])},</p>
      <p style="margin:0;">
        You've been paired for this round of ${escapeHtml(communityName)}'s call tree — a quick check-in call with
        ${partnerNames.length > 1 ? "your partners" : "your partner"}. Once you've talked, let us know how it went.
      </p>
    `,
    ctaText: "Share how the call went",
    ctaUrl: feedbackUrl,
    footerNote: `Sent by ${escapeHtml(communityName)} via Kinfolk.`,
  });
}

// Sent once per community per day (only when there's at least one
// celebrant), to every community_admin on file. Gives the admin a
// copy-paste-ready message per celebrant so they can post it in their own
// WhatsApp group manually — the whole point being to avoid per-member sends
// through the paid Meta Business API. Built by scripts/send-birthday-emails.mjs
// via the plain-JS mirror of this function — keep both in sync.
export function celebrantsDigestEmail({
  communityName,
  celebrants,
}: {
  communityName: string;
  celebrants: { name: string; message: string }[];
}): string {
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

export function trialReminderEmail({
  adminName,
  communityName,
  daysLeft,
  subscriptionUrl,
}: {
  adminName: string;
  communityName: string;
  daysLeft: 1 | 2;
  subscriptionUrl: string;
}): string {
  return shell({
    accentColor: "#f59e0b",
    badge: "⏳ Trial reminder",
    heading: daysLeft === 1 ? `${communityName}'s trial ends tomorrow` : `${communityName}'s trial ends in 2 days`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(adminName)},</p>
      <p style="margin:0;">
        ${daysLeft === 1 ? "Just a heads up — your trial ends tomorrow." : "Your trial ends in 2 days."}
        Pick a plan before then to keep everything running without a gap. Nothing you've set up will be lost either way.
      </p>
    `,
    ctaText: "Choose a plan",
    ctaUrl: subscriptionUrl,
    footerNote: "You're receiving this because you're the admin of a community on Kinfolk.",
  });
}

export function trialEndedEmail({
  adminName,
  communityName,
  subscriptionUrl,
}: {
  adminName: string;
  communityName: string;
  subscriptionUrl: string;
}): string {
  return shell({
    accentColor: "#e11d48",
    badge: "⏸️ Trial ended",
    heading: `${communityName}'s trial has ended`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(adminName)},</p>
      <p style="margin:0;">We've paused <strong>${escapeHtml(communityName)}</strong> while you pick a plan. Nothing has been deleted — sign in and choose a plan any time to pick up right where you left off.</p>
    `,
    ctaText: "Choose a plan",
    ctaUrl: subscriptionUrl,
    footerNote: "You're receiving this because you're the admin of a community on Kinfolk.",
  });
}
