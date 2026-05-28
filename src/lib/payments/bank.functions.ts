import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  listBanks as paystackListBanks,
  resolveAccount as paystackResolveAccount,
  createTransferRecipient,
} from "./paystack.server";

export const listBanks = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ currency: z.enum(["NGN", "USD"]).default("NGN") }).parse(i))
  .handler(async ({ data }) => {
    const banks = await paystackListBanks(data.currency);
    return banks.map((b) => ({ name: b.name, code: b.code }));
  });

export const resolveAccount = createServerFn({ method: "POST" })
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

export const saveCommunityBank = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    // Resolve to confirm + get account name
    const resolved = await paystackResolveAccount(data.account_number, data.bank_code);

    // Create recipient (NGN — USD payouts are manual per design)
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

    const { error } = await supabaseAdmin
      .from("communities")
      .update({
        bank_name: data.bank_name,
        bank_code: data.bank_code,
        account_number: data.account_number,
        account_name: resolved.account_name,
        paystack_recipient_code: recipient_code,
      })
      .eq("id", data.community_id);
    if (error) throw new Error(error.message);

    return {
      account_name: resolved.account_name,
      recipient_code,
    };
  });
