import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { initializeTransaction } from "./paystack.server";

const StartDonationInput = z.object({
  slug: z.string().min(1).max(128),
  currency: z.enum(["NGN", "USD"]),
  amount: z.number().positive().max(100_000_000),
  payer_name: z.string().min(1).max(120),
  payer_email: z.string().email().max(200),
});

export const startDonationCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) => StartDonationInput.parse(input))
  .handler(async ({ data }) => {
    const { data: donation, error } = await supabaseAdmin
      .from("donations")
      .select("id, purpose, status, target_ngn, target_usd, shareable_slug")
      .eq("shareable_slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!donation) throw new Error("Donation not found");
    if (donation.status !== "active") throw new Error("Donation is closed");
    if (data.currency === "NGN" && !donation.target_ngn) throw new Error("NGN not accepted");
    if (data.currency === "USD" && !donation.target_usd) throw new Error("USD not accepted");

    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const callback_url = `${proto}://${host}/donate/${data.slug}?status=success`;

    const tx = await initializeTransaction({
      email: data.payer_email,
      amount: data.amount,
      currency: data.currency,
      callback_url,
      metadata: {
        kind: "donation",
        donation_id: donation.id,
        payer_name: data.payer_name,
      },
    });

    return { authorization_url: tx.authorization_url, reference: tx.reference };
  });
