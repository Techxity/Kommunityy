import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/require-auth.server";
import { assertCommunityAdmin, assertSuperAdmin } from "./authz";
import {
  listBanks as paystackListBanks,
  resolveAccount as paystackResolveAccount,
  createTransferRecipient,
  createSubaccount,
  updateSubaccount,
} from "./paystack.server";
import { platformFeePctFor } from "./paystack-charge.server";

export const listBanks = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ currency: z.enum(["NGN", "USD"]).default("NGN") }).parse(i))
  .handler(async ({ data }) => {
    const banks = await paystackListBanks(data.currency);
    return banks.map((b) => ({ name: b.name, code: b.code }));
  });

export const resolveAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        account_number: z.string().regex(/^\d{6,12}$/),
        bank_code: z.string().min(2).max(10),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    return paystackResolveAccount(data.account_number, data.bank_code);
  });

// Community admins read their own bank details (hidden from public reads).
export const getCommunityBank = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) => z.object({ community_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCommunityAdmin(context.userId, data.community_id);
    const rows = await sql`
      SELECT bank_name, bank_code, account_number, account_name, paystack_recipient_code,
        paystack_subaccount_code, subaccount_percentage_charge
      FROM public.communities
      WHERE id = ${data.community_id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  });

export const saveCommunityBank = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((i) =>
    z
      .object({
        community_id: z.string().uuid(),
        bank_name: z.string().min(1).max(120),
        bank_code: z.string().min(2).max(10),
        account_number: z.string().regex(/^\d{6,12}$/),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCommunityAdmin(context.userId, data.community_id);

    const communityRows = await sql`
      SELECT name, paystack_subaccount_code FROM public.communities WHERE id = ${data.community_id} LIMIT 1
    `;
    const community = communityRows[0];
    if (!community) throw new Error("Community not found.");

    // Resolve to confirm + get account name
    const resolved = await paystackResolveAccount(data.account_number, data.bank_code);

    // Create recipient (NGN — USD payouts are manual per design). This still
    // gets created even once subaccounts exist, as a fallback path for any
    // balance that predates the subaccount (e.g. one final manual payout to
    // clear out whatever was collected before this community was migrated).
    let recipient_code: string | null = null;
    try {
      const r = await createTransferRecipient({
        name: resolved.account_name,
        account_number: data.account_number,
        bank_code: data.bank_code,
        currency: "NGN",
      });
      recipient_code = r.recipient_code;
    } catch (e) {
      // Recipient creation may fail if Transfers aren't enabled on the Paystack account.
      // Save bank details anyway; payouts will fall back to manual.
      console.error("createTransferRecipient failed:", e);
    }

    // Create (or update) a Paystack subaccount so new NGN charges settle
    // straight to this community's bank account instead of accruing in the
    // platform's balance for a manual payout. percentage_charge is the
    // platform's cut — same number applyVerifiedCharge already uses to
    // compute platform_fee/community_net for non-split charges, so this
    // keeps both paths in agreement.
    let subaccount_code: string | null = (community.paystack_subaccount_code as string | null) ?? null;
    let percentage_charge: number | null = null;
    try {
      percentage_charge = await platformFeePctFor(data.community_id);
      if (subaccount_code) {
        await updateSubaccount(subaccount_code, {
          business_name: community.name as string,
          bank_code: data.bank_code,
          account_number: data.account_number,
          percentage_charge,
        });
      } else {
        const s = await createSubaccount({
          business_name: community.name as string,
          bank_code: data.bank_code,
          account_number: data.account_number,
          percentage_charge,
        });
        subaccount_code = s.subaccount_code;
      }
    } catch (e) {
      // Same reasoning as the recipient fallback above — save bank details
      // regardless, checkout just won't pass a subaccount until this is
      // retried (e.g. by re-saving bank details).
      console.error("createSubaccount/updateSubaccount failed:", e);
    }

    await sql`
      UPDATE public.communities
      SET bank_name = ${data.bank_name},
          bank_code = ${data.bank_code},
          account_number = ${data.account_number},
          account_name = ${resolved.account_name},
          paystack_recipient_code = ${recipient_code},
          paystack_subaccount_code = ${subaccount_code},
          subaccount_percentage_charge = ${percentage_charge}
      WHERE id = ${data.community_id}
    `;

    return {
      account_name: resolved.account_name,
      recipient_code,
      subaccount_code,
    };
  });

// Super-admin, one-time: back-fills a Paystack subaccount for every
// community that already has verified bank details on file from the old
// manual-payout flow but hasn't been migrated yet. Safe to re-run — it only
// ever touches communities where paystack_subaccount_code IS NULL, so an
// already-migrated community (or one still mid-setup) is left untouched.
// Whatever community_net had already accrued before migration (settlement_
// mode = 'platform_held') stays payable through the existing payouts flow;
// only NEW charges after this runs will actually split via the subaccount.
export const migrateCommunitiesToSubaccounts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    const candidates = await sql`
      SELECT id, name, bank_code, account_number
      FROM public.communities
      WHERE accept_ngn = true
        AND bank_code IS NOT NULL
        AND account_number IS NOT NULL
        AND paystack_subaccount_code IS NULL
      ORDER BY created_at ASC
    `;

    const migrated: { id: string; name: string; subaccount_code: string }[] = [];
    const failed: { id: string; name: string; error: string }[] = [];

    for (const c of candidates) {
      try {
        const percentage_charge = await platformFeePctFor(c.id as string);
        const s = await createSubaccount({
          business_name: c.name as string,
          bank_code: c.bank_code as string,
          account_number: c.account_number as string,
          percentage_charge,
        });
        await sql`
          UPDATE public.communities
          SET paystack_subaccount_code = ${s.subaccount_code}, subaccount_percentage_charge = ${percentage_charge}
          WHERE id = ${c.id}::uuid
        `;
        migrated.push({ id: c.id as string, name: c.name as string, subaccount_code: s.subaccount_code });
      } catch (e: any) {
        failed.push({ id: c.id as string, name: c.name as string, error: e?.message ?? "Unknown error" });
      }
    }

    return { migrated, failed, skipped: 0, totalCandidates: candidates.length };
  });
