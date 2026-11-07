// Pure dues-arrears math, shared by the admin ledger server function and the
// automated reminder cron. No I/O here — just the "expected vs paid" logic —
// so it can be unit-tested in isolation (see test/dues-arrears.test.ts).
//
// The model is deliberately count-based rather than tracking exactly WHICH
// periods are unpaid: a member owes one payment per elapsed billing period
// from when their dues obligation starts, and any successful payment covers
// `months` periods (multi-month dues). Arrears = periods due − periods paid.
// This is robust to messy/legacy payment rows (some have no period_start) and
// answers the treasurer's actual question — "how far behind, and how much?".

import { monthsPerPeriod, type Ym } from "./dues-period.ts";

// Number of billing periods due from `startYm` up to and including the current
// period `nowYm`. The current (in-progress) period counts as due — dues are
// treated as owed at the start of each period. Returns 0 if start is in the
// future (e.g. a member who joins next month owes nothing yet).
export function periodsDue(startYm: Ym, nowYm: Ym, interval: string | null | undefined): number {
  const mpp = monthsPerPeriod(interval);
  const monthsBetween = nowYm.y * 12 + nowYm.m - (startYm.y * 12 + startYm.m);
  if (monthsBetween < 0) return 0;
  return Math.floor(monthsBetween / mpp) + 1;
}

// The later of two {y,m} pairs — used to floor a member's obligation at the
// later of when the plan started and when they joined (a member who joined
// after the plan began doesn't owe for periods before they existed).
export function laterYm(a: Ym, b: Ym): Ym {
  return a.y * 12 + a.m >= b.y * 12 + b.m ? a : b;
}

// A plan can price dues in NGN, USD, or both. A member is billed in the
// currency they actually pay in (taken from their latest payment); a member
// who has never paid falls back to the plan's primary currency. If the chosen
// currency isn't offered by the plan (e.g. they once paid USD but the plan now
// only lists NGN), fall back to the primary currency so we never value their
// arrears at 0 by accident.
export function resolveMemberDues(
  lastPaidCurrency: "NGN" | "USD" | null | undefined,
  amountNgn: number | null,
  amountUsd: number | null,
  primaryCurrency: "NGN" | "USD",
): { currency: "NGN" | "USD"; unitAmount: number } {
  const unitFor = (c: "NGN" | "USD") => (c === "NGN" ? amountNgn : amountUsd);
  let currency = lastPaidCurrency ?? primaryCurrency;
  let unit = unitFor(currency);
  if (unit == null) {
    currency = primaryCurrency;
    unit = unitFor(primaryCurrency);
  }
  return { currency, unitAmount: unit ?? 0 };
}

export type DuesAmounts = { amountNgn: number | null; amountUsd: number | null };
export type DuesPriceSource = "plan" | "rate" | "custom";

// What one member pays per period: their custom amount, else their assigned
// rate, else the plan default. Each level replaces the one below it whole — a
// custom ₦ amount doesn't inherit the plan's $ price, so a member can't end up
// with two unrelated prices.
export function resolveMemberPrice(
  plan: DuesAmounts,
  rate: DuesAmounts | null | undefined,
  custom: DuesAmounts | null | undefined,
): DuesAmounts & { source: DuesPriceSource } {
  if (custom && (custom.amountNgn != null || custom.amountUsd != null)) return { ...custom, source: "custom" };
  if (rate && (rate.amountNgn != null || rate.amountUsd != null)) return { ...rate, source: "rate" };
  return { amountNgn: plan.amountNgn, amountUsd: plan.amountUsd, source: "plan" };
}

export function primaryCurrencyOf(amounts: DuesAmounts): "NGN" | "USD" {
  return amounts.amountNgn != null ? "NGN" : "USD";
}

export type PaidTotals = { paidPeriods: number; lastPaid: string | null; lastCurrency: "NGN" | "USD" | null };

// Combines a member's payments linked by member id with older ones matched by
// email. Every payment row sits in exactly one of the two buckets, so adding
// them can't count a payment twice.
export function mergePaidTotals(a: PaidTotals | undefined, b: PaidTotals | undefined): PaidTotals | undefined {
  if (!a || !b) return a ?? b;
  const latest = (a.lastPaid ?? "") >= (b.lastPaid ?? "") ? a : b;
  return { paidPeriods: a.paidPeriods + b.paidPeriods, lastPaid: latest.lastPaid, lastCurrency: latest.lastCurrency };
}

export type ArrearsResult = {
  expectedPeriods: number;
  paidPeriods: number;
  arrearsPeriods: number;
  amountOwed: number;
};

export function computeArrears(args: {
  startYm: Ym;
  nowYm: Ym;
  interval: string | null | undefined;
  paidPeriods: number;
  unitAmount: number;
}): ArrearsResult {
  const expectedPeriods = periodsDue(args.startYm, args.nowYm, args.interval);
  const paidPeriods = Math.max(0, Math.floor(args.paidPeriods || 0));
  const arrearsPeriods = Math.max(0, expectedPeriods - paidPeriods);
  return {
    expectedPeriods,
    paidPeriods,
    arrearsPeriods,
    amountOwed: arrearsPeriods * (args.unitAmount || 0),
  };
}
