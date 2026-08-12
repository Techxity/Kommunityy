import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateOnlyString, toTimestampIso } from "../src/lib/date-only.ts";

test("passes through a bare YYYY-MM-DD string", () => {
  assert.equal(toDateOnlyString("2001-08-07"), "2001-08-07");
});

test("truncates a datetime string to the date part", () => {
  assert.equal(toDateOnlyString("2025-08-06 20:15:00+00"), "2025-08-06");
});

test("reads a Date object with UTC accessors (no timezone day-shift)", () => {
  // A `date` column comes back as UTC midnight of the intended day. Reading it
  // with local accessors could shift the day; toDateOnlyString must use UTC.
  const d = new Date(Date.UTC(2025, 7, 7)); // 2025-08-07T00:00:00Z
  assert.equal(toDateOnlyString(d), "2025-08-07");
  // A moment just before UTC midnight the next day still reports that day in UTC.
  const late = new Date(Date.UTC(2025, 7, 7, 23, 59, 59));
  assert.equal(toDateOnlyString(late), "2025-08-07");
});

test("empty / invalid inputs return empty string", () => {
  assert.equal(toDateOnlyString(null), "");
  assert.equal(toDateOnlyString(undefined), "");
  assert.equal(toDateOnlyString(""), "");
  assert.equal(toDateOnlyString("not a date"), "");
  assert.equal(toDateOnlyString(new Date("invalid")), "");
});

test("toTimestampIso normalizes the space form to a parseable instant", () => {
  const iso = toTimestampIso("2025-08-06 20:15:00.123+00");
  assert.equal(iso, new Date("2025-08-06T20:15:00.123+00:00").toISOString());
});

test("toTimestampIso handles Date objects and rejects junk", () => {
  const d = new Date(Date.UTC(2025, 7, 6, 20, 15));
  assert.equal(toTimestampIso(d), d.toISOString());
  assert.equal(toTimestampIso(""), "");
  assert.equal(toTimestampIso("garbage"), "");
});
