// A single function-middleware that wraps every server function it's attached
// to: if the handler throws, the full error is logged server-side and the
// caller receives only a sanitized, user-safe message (see toClientMessage).
// This is the one place that decides what error text is allowed to cross the
// wire to the browser.
//
// It's chained into requireAuth (below in require-auth.server.ts) so every
// authenticated server function gets it for free; public functions that call
// external services (Paystack, etc.) attach it explicitly.
import { createMiddleware } from "@tanstack/react-start";
import { toClientMessage } from "./errors";

export const errorBoundary = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    // Keep the real error in the server logs; hand the client a safe message.
    console.error("[server-fn error]", e);
    throw new Error(toClientMessage(e));
  }
});
