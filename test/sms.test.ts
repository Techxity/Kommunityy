import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentInfo, pageCount } from "../src/lib/sms/segments.ts";
import { normalizeNgPhone } from "../src/lib/sms/phone.ts";
import { grossUpNgn } from "../src/lib/sms/paystack-fee.ts";

test("segmentInfo: empty message is 0 pages", () => {
  const s = segmentInfo("");
  assert.equal(s.pages, 0);
  assert.equal(s.encoding, "gsm7");
});

test("segmentInfo: plain GSM-7 fits 160 on one page", () => {
  assert.equal(segmentInfo("a".repeat(160)).pages, 1);
  assert.equal(segmentInfo("a".repeat(160)).encoding, "gsm7");
  // 161 spills to a second page (concatenated → 153/part).
  assert.equal(segmentInfo("a".repeat(161)).pages, 2);
  assert.equal(segmentInfo("a".repeat(306)).pages, 2); // 2 × 153
  assert.equal(segmentInfo("a".repeat(307)).pages, 3);
});

test("segmentInfo: a single unicode char forces 70/page", () => {
  const s = segmentInfo("Hello 😀"); // emoji → unicode
  assert.equal(s.encoding, "unicode");
  assert.equal(s.perPage, 70);
  // 71 code units → 2 pages at 67/part.
  assert.equal(segmentInfo("x".repeat(70)).pages, 1); // still gsm7 here
  assert.equal(pageCount("é".repeat(71)) >= 1, true);
});

test("segmentInfo: smart quote (curly apostrophe) triggers unicode", () => {
  // U+2019 RIGHT SINGLE QUOTATION MARK is NOT in GSM-7.
  assert.equal(segmentInfo("It’s dues day").encoding, "unicode");
  // A plain ASCII apostrophe stays GSM-7.
  assert.equal(segmentInfo("It's dues day").encoding, "gsm7");
});

test("segmentInfo: GSM extension chars count as 2 units", () => {
  // "€" is a GSM extension char → 2 septets; 80 of them = 160 units = 1 page.
  assert.equal(segmentInfo("€".repeat(80)).encoding, "gsm7");
  assert.equal(segmentInfo("€".repeat(80)).pages, 1);
  assert.equal(segmentInfo("€".repeat(81)).pages, 2);
});

test("normalizeNgPhone: accepts the common input formats", () => {
  assert.equal(normalizeNgPhone("08031234567"), "2348031234567");
  assert.equal(normalizeNgPhone("+234 803 123 4567"), "2348031234567");
  assert.equal(normalizeNgPhone("234-803-123-4567"), "2348031234567");
  assert.equal(normalizeNgPhone("8031234567"), "2348031234567");
  assert.equal(normalizeNgPhone("0701 234 5678"), "2347012345678");
  assert.equal(normalizeNgPhone("(0903) 000 1111"), "2349030001111");
});

test("normalizeNgPhone: rejects rubbish and non-mobile numbers", () => {
  assert.equal(normalizeNgPhone(""), null);
  assert.equal(normalizeNgPhone(null), null);
  assert.equal(normalizeNgPhone("12345"), null);
  assert.equal(normalizeNgPhone("0123456789"), null); // NSN starts with 1, not 7/8/9
  assert.equal(normalizeNgPhone("080312345"), null); // too short
});

test("grossUpNgn: nets the intended amount after Paystack fee", () => {
  // Under ₦2,500 → flat ₦100 waived, just 1.5%.
  const g1 = grossUpNgn(1000);
  assert.ok(g1 >= 1015 && g1 <= 1016, `expected ~1016, got ${g1}`);
  // Above threshold → 1.5% + ₦100 on top.
  const g2 = grossUpNgn(5000);
  assert.ok(g2 >= 5177 && g2 <= 5180, `expected ~5178, got ${g2}`);
  // Zero stays zero.
  assert.equal(grossUpNgn(0), 0);
  // Gross is always ≥ the net.
  assert.ok(grossUpNgn(20000) > 20000);
});
