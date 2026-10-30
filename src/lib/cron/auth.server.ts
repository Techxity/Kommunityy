// Guards the cron route handlers. Vercel Cron automatically attaches
// `Authorization: Bearer <CRON_SECRET>` to every scheduled invocation when a
// CRON_SECRET environment variable is set on the project, so requiring it
// keeps these endpoints from being triggered by anyone on the internet.
// Returns a Response to short-circuit with when unauthorized, or null when OK.
export function checkCronAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ ok: false, error: "CRON_SECRET is not configured on the server." }, 503);
  }
  if (!constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
