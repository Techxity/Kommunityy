// Session cookie primitives, following TanStack Start's auth guide.
// The cookie holds an opaque session token (looked up in Neon on every
// request) — never a signed/self-contained token. See session.server.ts.
//
// Every function here that touches `@tanstack/react-start/server` is
// wrapped in `createServerOnlyFn`. The `.server.ts` suffix alone isn't
// enough: this module gets reached from the client bundle through
// `.middleware([requireAuth])` (the middleware reference itself has to
// stay in the client-side createServerFn config, even though its body
// never runs there), which pulls in getSessionUser -> readSessionToken.
// `createServerOnlyFn` gets a real compiler transform — on the client
// build it replaces the call with a throwing stub and strips the wrapped
// body (and its imports) entirely, rather than relying on best-effort
// dead-code elimination. Each call site's argument must be an inline
// function expression, not a reference to one, for the transform to find it.
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

// The `__Host-` prefix binds the cookie to this exact origin (no subdomain
// tricks) but requires `Secure`, which browsers only honor over HTTPS. Local
// dev runs on plain http://localhost, so we fall back to an unprefixed name
// there — same behavior, just without the extra origin lock, since it can't
// apply over http anyway.
const SECURE_COOKIE = "__Host-session";
const DEV_COOKIE = "session";
const SESSION_DAYS = 30;
const MAX_AGE_SECONDS = 60 * 60 * 24 * SESSION_DAYS;

const isHttps = createServerOnlyFn((): boolean => {
  try {
    return new URL(getRequest().url).protocol === "https:";
  } catch {
    return false;
  }
});

function cookieName(): string {
  return isHttps() ? SECURE_COOKIE : DEV_COOKIE;
}

export const setSessionCookie = createServerOnlyFn((token: string) => {
  const name = cookieName();
  const attrs = [
    `${name}=${token}`,
    `HttpOnly`,
    ...(isHttps() ? ["Secure"] : []),
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  setResponseHeader("Set-Cookie", attrs.join("; "));
});

export const clearSessionCookie = createServerOnlyFn(() => {
  const name = cookieName();
  setResponseHeader(
    "Set-Cookie",
    `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
});

export const readSessionToken = createServerOnlyFn((): string | null => {
  const header = getRequestHeader("cookie");
  if (!header) return null;
  const name = cookieName();
  for (const part of header.split(/;\s*/)) {
    // Split only on the first '=' — base64-ish token values are '='-safe
    // here, but this is the robust pattern regardless.
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
});
