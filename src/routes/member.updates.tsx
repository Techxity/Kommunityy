import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyBroadcasts } from "@/lib/membership/broadcasts.functions";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/member/updates")({
  component: Updates,
});

type Broadcasts = Awaited<ReturnType<typeof listMyBroadcasts>>;

function Updates() {
  const [broadcasts, setBroadcasts] = useState<Broadcasts | null>(null);

  useEffect(() => {
    listMyBroadcasts().then(setBroadcasts).catch(() => setBroadcasts([]));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Community updates</h1>
        <p className="text-sm text-muted-foreground">Announcements from your community admin.</p>
      </header>
      <div className="space-y-3">
        {broadcasts === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {broadcasts?.length === 0 && (
          <p className="text-sm text-muted-foreground">No updates yet.</p>
        )}
        {broadcasts?.map((b) => (
          <article key={b.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-accent" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{b.date}</span>
            </div>
            <h2 className="mt-3 font-display text-xl font-bold">{b.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{b.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
