// Gross-up for SMS wallet top-ups. The community should receive the full amount
// they chose as SMS credit, so the Paystack processing fee is added ON TOP of
// the charge (they pay a little more; the platform stays cost-neutral). Given a
// desired net `amountNgn`, this returns the gross amount to charge so that,
// after Paystack deducts its fee, `amountNgn` lands.
//
// Nigeria Paystack fees (local cards): 1.5% + ₦100, the ₦100 flat waived for
// transactions under ₦2,500, capped at ₦2,000 total. These are configurable
// constants so a fee change is a one-line edit.
export const PAYSTACK_NG = { pct: 0.015, flat: 100, waiveUnder: 2500, cap: 2000 } as const;

// Returns the gross ₦ to charge (rounded up to the nearest naira).
export function grossUpNgn(amountNgn: number): number {
  const { pct, flat, waiveUnder, cap } = PAYSTACK_NG;
  if (amountNgn <= 0) return 0;

  // Solve gross where gross - fee(gross) = amount, assuming the flat fee applies.
  let gross = (amountNgn + flat) / (1 - pct);
  // If that gross is actually under the waive threshold, the flat fee doesn't
  // apply — recompute without it.
  if (gross < waiveUnder) gross = amountNgn / (1 - pct);

  // Respect the fee cap: once the percentage fee alone would exceed the cap,
  // the real fee is just the cap, so gross is amount + cap.
  const feeAtGross = gross * pct + (gross >= waiveUnder ? flat : 0);
  if (feeAtGross > cap) gross = amountNgn + cap;

  return Math.ceil(gross);
}
