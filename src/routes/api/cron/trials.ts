import { createFileRoute } from "@tanstack/react-router";
import { runTrialLifecycleJob } from "@/lib/cron/trials.server";
import { checkCronAuth, json } from "@/lib/cron/auth.server";

// Daily trial-lifecycle job, triggered by Vercel Cron (see vercel.json). Runs
// the same logic as scripts/trial-lifecycle.mjs.
export const Route = createFileRoute("/api/cron/trials")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = checkCronAuth(request);
        if (denied) return denied;
        try {
          // Prefer APP_URL for the email CTA links; fall back to this request's
          // own origin so the "Choose a plan" button still points somewhere real.
          const baseUrl = process.env.APP_URL || new URL(request.url).origin;
          const result = await runTrialLifecycleJob(baseUrl);
          return json({ ok: true, ...result });
        } catch (e) {
          console.error("[cron/trials]", e);
          return json({ ok: false, error: "Trial job failed." }, 500);
        }
      },
    },
  },
});
