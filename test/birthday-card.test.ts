import { test } from "node:test";
import assert from "node:assert/strict";
import { birthdayCardAttachment, birthdayCardSvg } from "../scripts/lib/birthday-card.mjs";

test("birthday card is a WhatsApp Status portrait with the requested branding", () => {
  const svg = birthdayCardSvg("Ada Okafor", "Irewole Community");

  assert.match(svg, /width="1080" height="1920"/);
  assert.ok(svg.includes("Irewole Community"));
  assert.ok(svg.includes("Happy Birthday"));
  assert.ok(svg.includes("Ada Okafor"));
  assert.ok(svg.includes("akenrose.com"));
});

test("birthday card escapes member and community text as XML", () => {
  const svg = birthdayCardSvg("</text><script>alert(1)</script>", "A & B");

  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;/text&gt;&lt;script&gt;"));
  assert.ok(svg.includes("A &amp; B"));
});

test("birthday card attachment is a named SVG with valid base64 content", () => {
  const attachment = birthdayCardAttachment("Ada Okafor", "Irewole Community");
  const decoded = Buffer.from(attachment.content, "base64").toString("utf8");

  assert.equal(attachment.filename, "birthday-ada-okafor.svg");
  assert.equal(attachment.content_type, "image/svg+xml");
  assert.ok(decoded.includes("Happy Birthday"));
  assert.ok(decoded.includes("Irewole Community"));
});
