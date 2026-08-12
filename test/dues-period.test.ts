import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthsPerPeriod,
  periodUnit,
  parseYm,
  ymToDateStr,
  addMonths,
  formatYm,
  ymAfter,
  type Ym,
} from "../src/lib/dues-period.ts";

test("monthsPerPeriod maps intervals", () => {
  assert.equal(monthsPerPeriod("monthly"), 1);
  assert.equal(monthsPerPeriod("quarterly"), 3);
  assert.equal(monthsPerPeriod("yearly"), 12);
  assert.equal(monthsPerPeriod(null), 1);
  assert.equal(monthsPerPeriod(undefined), 1);
  assert.equal(monthsPerPeriod("weird"), 1);
});

test("periodUnit maps intervals", () => {
  assert.equal(periodUnit("monthly"), "month");
  assert.equal(periodUnit("quarterly"), "quarter");
  assert.equal(periodUnit("yearly"), "year");
  assert.equal(periodUnit(null), "month");
});

test("parseYm / ymToDateStr round-trip", () => {
  assert.deepEqual(parseYm("2026-08-01"), { y: 2026, m: 8 });
  assert.deepEqual(parseYm("2026-08-14"), { y: 2026, m: 8 }); // day ignored
  assert.equal(ymToDateStr({ y: 2026, m: 8 }), "2026-08-01");
  assert.equal(ymToDateStr({ y: 2026, m: 11 }), "2026-11-01"); // zero-pad
});

test("addMonths handles year rollover both directions", () => {
  assert.deepEqual(addMonths({ y: 2026, m: 12 }, 1), { y: 2027, m: 1 });
  assert.deepEqual(addMonths({ y: 2026, m: 1 }, -1), { y: 2025, m: 12 });
  assert.deepEqual(addMonths({ y: 2026, m: 8 }, 12), { y: 2027, m: 8 });
  assert.deepEqual(addMonths({ y: 2026, m: 8 }, 0), { y: 2026, m: 8 });
});

test("formatYm", () => {
  assert.equal(formatYm({ y: 2026, m: 1 }), "Jan 2026");
  assert.equal(formatYm({ y: 2026, m: 12 }), "Dec 2026");
});

test("ymAfter strict ordering", () => {
  assert.equal(ymAfter({ y: 2026, m: 11 }, { y: 2026, m: 8 }), true);
  assert.equal(ymAfter({ y: 2026, m: 8 }, { y: 2026, m: 8 }), false); // not strictly after
  assert.equal(ymAfter({ y: 2025, m: 12 }, { y: 2026, m: 1 }), false);
});

// Reproduces getMyDuesInfo's "next due" computation: the furthest period
// covered by any paid payment, so the checkout can default to the first
// uncovered month. Locks the money-adjacent behaviour verified by hand.
function computeNextDue(
  interval: string,
  payments: { status: string; periodStart: string | null; months: number }[],
): string | null {
  const mpp = monthsPerPeriod(interval);
  let nextDue: Ym | null = null;
  for (const p of payments) {
    if (p.status !== "paid" || !p.periodStart) continue;
    const end = addMonths(parseYm(p.periodStart), p.months * mpp);
    if (!nextDue || ymAfter(end, nextDue)) nextDue = end;
  }
  return nextDue ? ymToDateStr(nextDue) : null;
}

test("nextDue: monthly, 3 months from Aug 2026 -> Nov 2026", () => {
  assert.equal(computeNextDue("monthly", [{ status: "paid", periodStart: "2026-08-01", months: 3 }]), "2026-11-01");
});

test("nextDue: quarterly, 2 quarters from Jan 2026 -> Jul 2026", () => {
  assert.equal(computeNextDue("quarterly", [{ status: "paid", periodStart: "2026-01-01", months: 2 }]), "2026-07-01");
});

test("nextDue: picks the furthest-covered across multiple payments", () => {
  const payments = [
    { status: "paid", periodStart: "2026-01-01", months: 2 }, // covers Jan–Feb
    { status: "paid", periodStart: "2026-08-01", months: 3 }, // covers Aug–Oct -> next Nov
    { status: "paid", periodStart: "2026-03-01", months: 1 },
  ];
  assert.equal(computeNextDue("monthly", payments), "2026-11-01");
});

test("nextDue: ignores non-paid and period-less (legacy) payments", () => {
  const payments = [
    { status: "failed", periodStart: "2027-01-01", months: 6 }, // ignored (not paid)
    { status: "paid", periodStart: null, months: 3 }, // ignored (legacy, no period)
    { status: "paid", periodStart: "2026-08-01", months: 1 },
  ];
  assert.equal(computeNextDue("monthly", payments), "2026-09-01");
});

test("nextDue: null when nothing qualifies", () => {
  assert.equal(computeNextDue("monthly", []), null);
  assert.equal(computeNextDue("monthly", [{ status: "paid", periodStart: null, months: 1 }]), null);
});
