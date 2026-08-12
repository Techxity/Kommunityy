import { createFileRoute } from "@tanstack/react-router";
import { runDuesReminderJob } from "@/lib/cron/dues-reminders.server";
import { checkCronAuth, json } from "@/lib/cron/auth.server";

// Standalone dues-reminder job endpoint. It's ALSO invoked from the daily
// trials cron (src/routes/api/cron/trials.ts) so it runs without needing its
// own Vercel Cron entry — Vercel Hobby caps at 2 crons and we already use both.
// This route exists so the job can be triggered on its own too (GitHub Actions,
// Railway, an uptime pinger, or manual curl), all behind the same CRON_SECRET.
export const Route = createFileRoute("/api/cron/dues-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = checkCronAuth(request);
        if (denied) return denied;
        try {
          const baseUrl = process.env.APP_URL || new URL(request.url).origin;
          const result = await runDuesReminderJob(baseUrl);
          return json({ ok: true, ...result });
        } catch (e) {
          console.error("[cron/dues-reminders]", e);
          return json({ ok: false, error: "Dues reminder job failed." }, 500);
        }
      },
    },
  },
});
