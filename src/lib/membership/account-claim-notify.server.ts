// Emails every admin of a community when a phone-only member asks to set up a
// login (see claimMemberAccount in auth.functions.ts). Best-effort: a failed
// send must never fail the request itself — the admin still sees it on the
// Pending approvals page — so errors are only logged.
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { accountClaimRequestEmail } from "@/lib/email-templates";
import { appOrigin } from "@/lib/app-origin.server";

export async function notifyAdminsOfAccountClaim(memberId: string, phone: string): Promise<void> {
  try {
    const rows = await sql`
      SELECT m.name AS member_name, c.name AS community_name, u.email
      FROM public.members m
      JOIN public.communities c ON c.id = m.community_id
      JOIN public.user_roles ur ON ur.community_id = c.id AND ur.role = 'community_admin'
      JOIN public.users u ON u.id = ur.user_id
      WHERE m.id = ${memberId}::uuid AND u.email IS NOT NULL
    `;
    if (rows.length === 0) return;

    const memberName = rows[0].member_name as string;
    const communityName = rows[0].community_name as string;
    const html = accountClaimRequestEmail({
      memberName,
      memberPhone: phone,
      communityName,
      reviewUrl: `${appOrigin()}/admin/members/pending`,
    });

    for (const r of rows) {
      const result = await sendEmail({
        to: r.email as string,
        subject: `Login request from ${memberName} — ${communityName}`,
        html,
      });
      if (!result.ok) console.error(`[account-claim] notify failed: ${result.error ?? "unknown"}`);
    }
  } catch (e: any) {
    console.error(`[account-claim] notify failed: ${e?.message ?? e}`);
  }
}
