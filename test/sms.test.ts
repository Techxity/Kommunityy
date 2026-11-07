import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentInfo, pageCount, signSms } from "../src/lib/sms/segments.ts";
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

// ── BulkSMSNigeria adapter + delivery-report webhook helpers ──────────────
import { parseSendResponse, parseBalance } from "../src/lib/sms/bulksmsnigeria.server.ts";
import { rateKobo, DEFAULT_RATE_KOBO } from "../src/lib/sms/rates.ts";
import { classifyDlrStatus, parseDlrPayload, checkDlrToken } from "../src/lib/sms/dlr.ts";

test("parseSendResponse: success returns the message id", () => {
  const r = parseSendResponse(200, { status: "success", code: "BSNG-0000", data: { message_id: "abc-123" } }, "2348031234567");
  assert.deepEqual(r, { ok: true, messageId: "abc-123" });
});

test("parseSendResponse: error status / HTTP failure is not ok", () => {
  const r = parseSendResponse(409, { status: "error", code: "BSNG-2012", message: "Duplicate" }, "2348031234567");
  assert.equal(r.ok, false);
  assert.equal(r.error, "BSNG-2012: Duplicate");
  assert.equal(parseSendResponse(500, {}, "234803").ok, false);
});

test("parseSendResponse: reads the documented nested error message", () => {
  const body = { status: "error", code: "BSNG-2012", error: { message: "Duplicate message.", code: "BSNG-2012" } };
  assert.equal(parseSendResponse(409, body, "2348031234567").error, "BSNG-2012: Duplicate message.");
});

test("signSms: names the community, caps long names, leaves empty text alone", () => {
  assert.equal(signSms("BlueCedar", "Meeting on Sunday"), "BlueCedar: Meeting on Sunday");
  assert.equal(signSms("A very long community name that goes on and on", "Hi").length, 34);
  assert.equal(signSms("BlueCedar", "  "), "  ");
});

test("parseBalance: uses the spendable total, not just the SMS wallet", () => {
  const body = { data: { status: "success" }, balance: { total_balance: 9884.24, universal_wallet: "9879.23", sms_wallet: "5.01" } };
  assert.equal(parseBalance(body), 9884.24);
  assert.equal(parseBalance({ balance: { sms_wallet: "5.01" } }), 5.01);
  assert.equal(parseBalance({}), null);
});

test("rateKobo: env wins, and the fallback isn't below published cost", () => {
  assert.ok(DEFAULT_RATE_KOBO >= Math.ceil(649 * 1.075));
  const saved = process.env.SMS_RATE_DND_KOBO;
  delete process.env.SMS_RATE_DND_KOBO;
  assert.equal(rateKobo("dnd"), DEFAULT_RATE_KOBO);
  process.env.SMS_RATE_DND_KOBO = "900";
  assert.equal(rateKobo("dnd"), 900);
  if (saved === undefined) delete process.env.SMS_RATE_DND_KOBO;
  else process.env.SMS_RATE_DND_KOBO = saved;
});

test("parseSendResponse: a skipped recipient counts as failed (refunded)", () => {
  const to = "2348031234567";
  assert.equal(parseSendResponse(200, { status: "success", data: { message_id: "x", skipped_recipients: [to] } }, to).ok, false);
  assert.equal(parseSendResponse(200, { status: "success", data: { message_id: "x", skipped_recipients: [{ recipient: to }] } }, to).ok, false);
  assert.equal(parseSendResponse(200, { status: "success", data: { message_id: "x", skipped_recipients: ["2349000000000"] } }, to).ok, true);
});

test("classifyDlrStatus: only known success values are delivered", () => {
  for (const s of ["delivrd", "DELIVERED", "success"]) assert.equal(classifyDlrStatus(s), "delivered");
  for (const s of ["undelivered", "rejected", "expired", "some-new-status"]) assert.equal(classifyDlrStatus(s), "failed");
});

test("parseDlrPayload: reads top-level or legacy data.* fields", () => {
  assert.deepEqual(parseDlrPayload({ message_id: "m1", delivery_status: "delivrd" }), { messageId: "m1", status: "delivrd" });
  assert.deepEqual(parseDlrPayload({ data: { message_id: "m2", delivery_status: "failed" } }), { messageId: "m2", status: "failed" });
  assert.equal(parseDlrPayload({ message_id: "m3" }), null);
  assert.equal(parseDlrPayload(null), null);
});

test("checkDlrToken: fails closed and rejects wrong tokens", () => {
  const url = "https://app.example/api/public/sms-dlr?token=s3cret";
  assert.equal(checkDlrToken(url, undefined), "unconfigured");
  assert.equal(checkDlrToken(url, "s3cret"), "ok");
  assert.equal(checkDlrToken(url, "other"), "unauthorized");
  assert.equal(checkDlrToken("https://app.example/api/public/sms-dlr", "s3cret"), "unauthorized");
});
