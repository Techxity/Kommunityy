import { test } from "node:test";
import assert from "node:assert/strict";
import { birthdayView } from "../src/lib/birthday-view.ts";

const NOW = new Date(Date.UTC(2026, 7, 10)); // 2026-08-10

test("upcoming birthday: Scheduled and shown", () => {
  assert.deepEqual(birthdayView("1990-08-14", false, NOW), { show: true, label: "Scheduled" });
});

test("today's birthday, not yet sent: Scheduled and shown", () => {
  assert.deepEqual(birthdayView("1990-08-10", false, NOW), { show: true, label: "Scheduled" });
});

test("sent this year shows 'Sent' regardless of upcoming/past", () => {
  assert.deepEqual(birthdayView("1990-08-14", true, NOW), { show: true, label: "Sent" });
  assert.deepEqual(birthdayView("1990-08-09", true, NOW), { show: true, label: "Sent" });
});

test("passed 1 day, unsent: Missed and still shown", () => {
  assert.deepEqual(birthdayView("1990-08-09", false, NOW), { show: true, label: "Missed" });
});

test("passed exactly 2 days: still shown (boundary)", () => {
  assert.deepEqual(birthdayView("1990-08-08", false, NOW), { show: true, label: "Missed" });
});

test("passed 3 days: cleared from the list (show=false)", () => {
  assert.equal(birthdayView("1990-08-07", false, NOW).show, false);
  // even a sent one clears after the 2-day window
  assert.equal(birthdayView("1990-08-07", true, NOW).show, false);
});

test("uses UTC so the day doesn't shift", () => {
  // A birthday of Aug 10 evaluated at Aug 10 UTC is 'today', not off-by-one.
  assert.equal(birthdayView("2000-08-10", false, new Date(Date.UTC(2026, 7, 10, 23, 30))).label, "Scheduled");
});
