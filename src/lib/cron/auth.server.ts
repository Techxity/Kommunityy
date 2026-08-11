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
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
