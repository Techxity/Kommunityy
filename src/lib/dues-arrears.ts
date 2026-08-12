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
