import { createFileRoute } from "@tanstack/react-router";
import { runBirthdayJob } from "@/lib/cron/birthdays.server";
import { checkCronAuth, json } from "@/lib/cron/auth.server";

// Daily birthday job, triggered by Vercel Cron (see vercel.json). Runs the
// same logic as scripts/send-birthday-emails.mjs.
export const Route = createFileRoute("/api/cron/birthdays")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = checkCronAuth(request);
        if (denied) return denied;
        try {
          const result = await runBirthdayJob();
          return json({ ok: true, ...result });
        } catch (e) {
          console.error("[cron/birthdays]", e);
          return json({ ok: false, error: "Birthday job failed." }, 500);
        }
      },
    },
  },
});
