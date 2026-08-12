import { test } from "node:test";
import assert from "node:assert/strict";
import {
  birthdayEmail,
  broadcastEmail,
  passwordResetEmail,
  celebrantsDigestEmail,
  memberAccountReadyEmail,
} from "../src/lib/email-templates.ts";

test("escapes HTML-significant characters in member-supplied text", () => {
  const html = broadcastEmail({ communityName: "Estate", bodyText: "<script>alert('x')</script> & <b>hi</b>" });
  assert.ok(!html.includes("<script>"), "raw <script> must not survive into the email body");
  assert.ok(html.includes("&lt;script&gt;"), "angle brackets should be entity-escaped");
  assert.ok(html.includes("&amp;"), "ampersand should be entity-escaped");
});

test("birthday email escapes the member name and includes the message", () => {
  const html = birthdayEmail({ memberName: "A<b>da", communityName: "Estate", message: "Have a great <one>!" });
  assert.ok(!html.includes("A<b>da"));
  assert.ok(html.includes("A&lt;b&gt;da"));
  assert.ok(html.includes("Have a great &lt;one&gt;!"));
});

test("password reset email contains the reset URL and a CTA", () => {
  const url = "https://kommunity.app/reset-password/abc123";
  const html = passwordResetEmail({ name: "Grace Akinsola", resetUrl: url });
  assert.ok(html.includes(url), "the reset link must be present");
  assert.ok(html.includes("Reset password"), "CTA label present");
  assert.ok(html.includes("Grace"), "greets by first name");
});

test("password reset email works with a null name", () => {
  const html = passwordResetEmail({ name: null, resetUrl: "https://x/y" });
  assert.ok(html.includes("https://x/y"));
  assert.ok(!html.includes("undefined"), "must not render 'undefined' when name is null");
});

test("celebrants digest pluralizes and lists everyone", () => {
  const one = celebrantsDigestEmail({ communityName: "Estate", celebrants: [{ name: "Ada", message: "Happy birthday, Ada!" }] });
  assert.ok(one.includes("1 member is celebrating today"));
  const many = celebrantsDigestEmail({
    communityName: "Estate",
    celebrants: [
      { name: "Ada", message: "hi" },
      { name: "Tunde", message: "hi" },
    ],
  });
  assert.ok(many.includes("2 members are celebrating today"));
  assert.ok(many.includes("Ada") && many.includes("Tunde"));
});

test("member-account-ready email includes the setup link", () => {
  const html = memberAccountReadyEmail({ memberName: "Ada Okafor", communityName: "Estate", setupUrl: "https://x/invite/tok" });
  assert.ok(html.includes("https://x/invite/tok"));
  assert.ok(html.includes("Ada"));
});
