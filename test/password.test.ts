import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "../src/lib/auth/password.ts";

test("hash then verify succeeds for the right password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, /^pbkdf2\$100000\$/);
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("verify fails for the wrong password", async () => {
  const hash = await hashPassword("hunter2");
  assert.equal(await verifyPassword("Hunter2", hash), false);
  assert.equal(await verifyPassword("", hash), false);
  assert.equal(await verifyPassword("hunter2 ", hash), false);
});

test("each hash uses a fresh salt (no deterministic reuse)", async () => {
  const a = await hashPassword("samepass");
  const b = await hashPassword("samepass");
  assert.notEqual(a, b, "two hashes of the same password must differ (random salt)");
  // ...but each still verifies its own password.
  assert.equal(await verifyPassword("samepass", a), true);
  assert.equal(await verifyPassword("samepass", b), true);
});

test("malformed stored hashes are rejected, not thrown", async () => {
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
  assert.equal(await verifyPassword("x", "pbkdf2$abc$salt$hash"), false); // non-numeric iterations
  assert.equal(await verifyPassword("x", "pbkdf2$0$salt$hash"), false); // zero iterations
  assert.equal(await verifyPassword("x", ""), false);
});

test("DUMMY_PASSWORD_HASH verifies false for arbitrary input (timing-equalizer)", async () => {
  // login runs verify against this when the email doesn't exist, so it must
  // parse cleanly (return false) rather than throw.
  assert.equal(await verifyPassword("anything", DUMMY_PASSWORD_HASH), false);
  assert.equal(await verifyPassword("", DUMMY_PASSWORD_HASH), false);
});
