// Central mapping from a thrown error to a message that's safe to show a
// user. Server functions throw two kinds of errors:
//   1. Deliberate, user-facing messages ("You don't manage a community yet.")
//      — short, clean, meant to be read by a person. These pass through.
//   2. Internal/technical failures (a Paystack HTTP error, a raw SQL/driver
//      message, a TypeError) — these must never reach the browser. They're
//      logged server-side and replaced with a generic message.
//
// AppError is an explicit opt-in marker for (1): its message always passes
// through regardless of content. For everything else we fall back to a
// signature check so existing `throw new Error("friendly text")` call sites
// keep working without being rewritten.

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

const GENERIC = "Something went wrong. Please try again.";

// Hallmarks of an internal error whose raw text should be hidden.
const INTERNAL_SIGNATURES =
  /\b(paystack|resend|neon|postgres|psql)\b|\bsql\b|syntax error|constraint|violat|duplicate key|relation "|column "|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|fetch failed|failed to fetch|network is unreachable|cannot read propert|is not a function|is not defined|TypeError|SyntaxError|ReferenceError|RangeError/i;

export function toClientMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!raw) return GENERIC;
  // Deliberate user-facing messages are short and non-technical; anything
  // long or matching an internal signature is replaced.
  if (raw.length > 200) return GENERIC;
  if (INTERNAL_SIGNATURES.test(raw)) return GENERIC;
  return raw;
}
