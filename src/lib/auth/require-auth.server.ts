// Replaces the old Supabase-based `requireSupabaseAuth`. Reads the session
// cookie, looks the session up in Neon, and either throws (protected server
// functions) or returns null (optional checks, e.g. the `me` query).
//
// `.server.ts` suffix: pulls in session-cookie.server.ts (which touches
// `@tanstack/react-start/server`) — see the note there. This file is only
// ever consumed through `.middleware([requireAuth])` or by auth.functions.ts
// inside a `.handler()` closure, never imported directly by client code.
import { createMiddleware } from "@tanstack/react-start";
import { readSessionToken } from "./session-cookie.server";
import { verifySessionToken } from "./session.server";
import { errorBoundary } from "@/lib/error-boundary.server";

export async function getSessionUser(): Promise<{ userId: string } | null> {
  const token = readSessionToken();
  if (!token) return null;
  return verifySessionToken(token);
}

// Attach to any server function that reads or writes private data. Chaining
// errorBoundary here means every authenticated server function automatically
// gets internal-error sanitization too — no per-function wiring needed.
export const requireAuth = createMiddleware({ type: "function" })
  .middleware([errorBoundary])
  .server(async ({ next }) => {
    const session = await getSessionUser();
    if (!session) throw new Error("Unauthorized: no active session");
    return next({ context: { userId: session.userId } });
  });
