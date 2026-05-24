import { createFileRoute } from "@tanstack/react-router";
import { broadcasts } from "@/lib/mock-data";
import { Megaphone, Send } from "lucide-react";

export const Route = createFileRoute("/admin/broadcast")({
  component: Broadcast,
});

const TEMPLATES = [
  { name: "Meeting reminder", body: "Dear member, this is a friendly reminder that our monthly meeting takes place on…" },
  { name: "Welcome new members", body: "Please join us in welcoming our newest members to the community…" },
  { name: "Holiday greetings", body: "Wishing you and your loved ones a peaceful and joyful holiday season…" },
];

function Broadcast() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Broadcasts</h1>
        <p className="text-sm text-muted-foreground">Send a single message to every active member's inbox.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-2">
          <h2 className="font-display text-lg font-semibold">New broadcast</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <input className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring" placeholder="A clear, descriptive subject" />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea rows={9} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring" placeholder="Write your message…" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">Will be sent to <span className="font-semibold text-foreground">231 active members</span>.</p>
              <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90">
                <Send className="h-3.5 w-3.5" /> Send broadcast
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Templates</p>
            <div className="mt-3 space-y-2">
              {TEMPLATES.map((t) => (
                <button key={t.name} className="block w-full rounded-xl border border-border p-3 text-left text-sm hover:border-primary hover:bg-primary/5">
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Recently sent</p>
            <ul className="mt-3 space-y-3">
              {broadcasts.map((b) => (
                <li key={b.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <Megaphone className="mt-0.5 h-4 w-4 text-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.date} · reached {b.reach}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
