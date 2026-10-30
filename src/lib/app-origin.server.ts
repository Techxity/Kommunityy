// The one origin every emailed link and Paystack callback URL is built from.
// Never derived from the incoming request in production: the Host /
// X-Forwarded-Host headers are client-influenced, and a password-reset or
// invite link built from them could point at an attacker's site and leak the
// token inside it.
//
// Order: APP_URL (set this on Vercel, e.g. https://app.kommunity.ng) →
// Vercel's own system env vars (production domain, or this deployment's URL
// on previews) → the request origin, which only ever applies to local dev.
//
// Wrapped in createServerOnlyFn for the same reason as
// session-cookie.server.ts — callers are reachable from the client bundle.
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const appOrigin = createServerOnlyFn((): string => {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL) {
    const host =
      process.env.VERCEL_ENV === "production"
        ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL)
        : process.env.VERCEL_URL;
    if (host) return `https://${host}`;
    throw new Error("APP_URL is not configured.");
  }
  return new URL(getRequest().url).origin;
});
