import { test } from "node:test";
import assert from "node:assert/strict";
import { toClientMessage, AppError } from "../src/lib/errors.ts";

const GENERIC = "Something went wrong. Please try again.";

test("passes through deliberate user-facing messages", () => {
  const userFacing = [
    "You don't manage a community yet.",
    "Invalid email or password.",
    "An account with that email already exists.",
    "This community has been suspended. Contact support for help.",
    "Too many attempts. Please wait a few minutes and try again.",
    "Network connection error. Please try again.",
    "Only NGN 5,000 available in dues",
    "End the current election before starting a new cycle.",
    "You're not an active member of that community.",
  ];
  for (const m of userFacing) {
    assert.equal(toClientMessage(new Error(m)), m, `should pass through: ${m}`);
  }
});

test("masks internal / technical messages", () => {
  const internal = [
    "Paystack /transaction/initialize failed: Invalid key",
    'null value in column "email" violates not-null constraint',
    "Cannot read properties of undefined (reading 'id')",
    "fetch failed",
    'syntax error at or near "SELECT"',
    "xyz is not a function",
    "ECONNREFUSED 10.0.0.1:5432",
    "Resend 429: rate limited",
  ];
  for (const m of internal) {
    assert.equal(toClientMessage(new Error(m)), GENERIC, `should mask: ${m}`);
  }
});

test("AppError always passes through, even if it looks technical", () => {
  // AppError is the explicit opt-in marker for a user-safe message.
  assert.equal(toClientMessage(new AppError("Your Paystack account isn't set up")), "Your Paystack account isn't set up");
});

test("masks empty, non-error, and over-long values", () => {
  assert.equal(toClientMessage(new Error("")), GENERIC);
  assert.equal(toClientMessage(null), GENERIC);
  assert.equal(toClientMessage(undefined), GENERIC);
  assert.equal(toClientMessage({ weird: true }), GENERIC);
  assert.equal(toClientMessage(new Error("x".repeat(201))), GENERIC);
});

test("plain string errors are classified too", () => {
  assert.equal(toClientMessage("Invalid email or password."), "Invalid email or password.");
  assert.equal(toClientMessage("TypeError: boom"), GENERIC);
});
