import { createFileRoute } from "@tanstack/react-router";
import { runTrialLifecycleJob } from "@/lib/cron/trials.server";
import { runDuesReminderJob } from "@/lib/cron/dues-reminders.server";
import { checkCronAuth, json } from "@/lib/cron/auth.server";

// Daily community-lifecycle cron, triggered by Vercel Cron (see vercel.json).
// Runs the trial-lifecycle job AND the dues-arrears reminder job. They're
// batched into one endpoint because Vercel Hobby allows only 2 cron entries
// (we use them for /birthdays and /trials); the dues reminder self-throttles
// per member, so running it daily still means each defaulter is nudged at most
// once per cooldown window. The reminder also has its own route
// (/api/cron/dues-reminders) for triggering it independently.
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
          const trials = await runTrialLifecycleJob(baseUrl);
          // A failure in the dues reminders shouldn't sink the trial job's
          // result (or vice-versa) — report both, but don't let one throw out
          // the other.
          let dues: Awaited<ReturnType<typeof runDuesReminderJob>> | { error: string };
          try {
            dues = await runDuesReminderJob(baseUrl);
          } catch (e) {
            console.error("[cron/dues-reminders]", e);
            dues = { error: "Dues reminder job failed." };
          }
          return json({ ok: true, trials, dues });
        } catch (e) {
          console.error("[cron/trials]", e);
          return json({ ok: false, error: "Trial job failed." }, 500);
        }
      },
    },
  },
});
