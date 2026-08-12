import { test } from "node:test";
import assert from "node:assert/strict";
import { periodsDue, laterYm, computeArrears } from "../src/lib/dues-arrears.ts";

test("periodsDue counts the current period as owed (monthly)", () => {
  // Same month → 1 period due.
  assert.equal(periodsDue({ y: 2026, m: 8 }, { y: 2026, m: 8 }, "monthly"), 1);
  // 3 months later → 4 periods (start month through now, inclusive).
  assert.equal(periodsDue({ y: 2026, m: 5 }, { y: 2026, m: 8 }, "monthly"), 4);
  // Across a year boundary.
  assert.equal(periodsDue({ y: 2025, m: 11 }, { y: 2026, m: 2 }, "monthly"), 4);
});

test("periodsDue respects interval size", () => {
  // Quarterly: 6 months elapsed → floor(6/3)+1 = 3 quarters.
  assert.equal(periodsDue({ y: 2026, m: 2 }, { y: 2026, m: 8 }, "quarterly"), 3);
  // Yearly: 13 months elapsed → floor(13/12)+1 = 2 years.
  assert.equal(periodsDue({ y: 2025, m: 7 }, { y: 2026, m: 8 }, "yearly"), 2);
  // Unknown/legacy interval defaults to monthly.
  assert.equal(periodsDue({ y: 2026, m: 6 }, { y: 2026, m: 8 }, "weekly"), 3);
});

test("periodsDue returns 0 for a start in the future", () => {
  assert.equal(periodsDue({ y: 2026, m: 10 }, { y: 2026, m: 8 }, "monthly"), 0);
});

test("laterYm picks the later of two months", () => {
  assert.deepEqual(laterYm({ y: 2026, m: 1 }, { y: 2026, m: 5 }), { y: 2026, m: 5 });
  assert.deepEqual(laterYm({ y: 2027, m: 1 }, { y: 2026, m: 12 }), { y: 2027, m: 1 });
  // Equal → either (returns the first).
  assert.deepEqual(laterYm({ y: 2026, m: 3 }, { y: 2026, m: 3 }), { y: 2026, m: 3 });
});

test("computeArrears: a member three months behind on ₦5,000 monthly dues", () => {
  const r = computeArrears({
    startYm: { y: 2026, m: 5 },
    nowYm: { y: 2026, m: 8 },
    interval: "monthly",
    paidPeriods: 1,
    unitAmount: 5000,
  });
  assert.equal(r.expectedPeriods, 4);
  assert.equal(r.paidPeriods, 1);
  assert.equal(r.arrearsPeriods, 3);
  assert.equal(r.amountOwed, 15000);
});

test("computeArrears: fully paid-up member owes nothing", () => {
  const r = computeArrears({
    startYm: { y: 2026, m: 5 },
    nowYm: { y: 2026, m: 8 },
    interval: "monthly",
    paidPeriods: 4,
    unitAmount: 5000,
  });
  assert.equal(r.arrearsPeriods, 0);
  assert.equal(r.amountOwed, 0);
});

test("computeArrears: an over-payer never shows negative arrears", () => {
  const r = computeArrears({
    startYm: { y: 2026, m: 7 },
    nowYm: { y: 2026, m: 8 },
    interval: "monthly",
    paidPeriods: 12, // paid a year up front
    unitAmount: 5000,
  });
  assert.equal(r.arrearsPeriods, 0);
  assert.equal(r.amountOwed, 0);
});

test("computeArrears: never-paid member (0 periods) owes the full elapsed span", () => {
  const r = computeArrears({
    startYm: { y: 2026, m: 6 },
    nowYm: { y: 2026, m: 8 },
    interval: "monthly",
    paidPeriods: 0,
    unitAmount: 2500,
  });
  assert.equal(r.arrearsPeriods, 3);
  assert.equal(r.amountOwed, 7500);
});

test("computeArrears: quarterly plan tallies in quarters", () => {
  const r = computeArrears({
    startYm: { y: 2026, m: 2 },
    nowYm: { y: 2026, m: 8 },
    interval: "quarterly",
    paidPeriods: 1,
    unitAmount: 12000,
  });
  assert.equal(r.expectedPeriods, 3);
  assert.equal(r.arrearsPeriods, 2);
  assert.equal(r.amountOwed, 24000);
});
