// Per-page SMS price in kobo, charged to community wallets at cost. Set from the
// provider's rate card in env. The fallback is BulkSMSNigeria's published
// pay-as-you-go rate, ₦6.49 + 7.5% VAT = ₦6.98, so a missing env var can't send
// texts below cost. Corporate (DND) routes can cost more: set the real rate.
export const DEFAULT_RATE_KOBO = 698;

export function rateKobo(route: "dnd" | "generic"): number {
  const raw = route === "dnd" ? process.env.SMS_RATE_DND_KOBO : process.env.SMS_RATE_GENERIC_KOBO;
  return Number(raw) || DEFAULT_RATE_KOBO;
}
