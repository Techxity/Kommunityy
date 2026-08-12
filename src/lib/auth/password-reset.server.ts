// Server-only helper for the "forgot password" flow. Creates a single-use,
// short-lived reset token, stores only its SHA-256 hash, and emails the raw
// token in a link. getOrigin is wrapped in createServerOnlyFn for the same
// reason as session-cookie.server.ts — this module is reachable from the
// client bundle through the auth server functions, so any direct
// `@tanstack/react-start/server` usage must be compiler-stripped.
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";

const getOrigin = createServerOnlyFn((): string => new URL(getRequest().url).origin);

const RESET_MINUTES = 60;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashResetToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Issues a fresh reset token for the user and emails the link. Any previous
// unused tokens for this user are cleared first, so only the newest link works.
export async function createAndSendReset(user: { id: string; email: string; name: string | null }): Promise<void> {
  await sql`DELETE FROM public.password_resets WHERE user_id = ${user.id}::uuid AND used_at IS NULL`;

  const token = randomToken();
  const tokenHash = await hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000).toISOString();
  await sql`
    INSERT INTO public.password_resets (user_id, token_hash, expires_at)
    VALUES (${user.id}::uuid, ${tokenHash}, ${expiresAt})
  `;

  const link = `${getOrigin()}/reset-password/${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Kommunity password",
    html: passwordResetEmail({ name: user.name, resetUrl: link }),
  });
}
