import { createFileRoute } from "@tanstack/react-router";
import { callTreePairs } from "@/lib/mock-data";
import { PhoneCall, Play, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/admin/calltree")({
  component: CallTree,
});

const STATUS_TONES: Record<string, string> = {
  "Doing great": "bg-success/15 text-success",
  "Not bad": "bg-accent/15 text-accent",
  "Sick": "bg-warning/20 text-warning-foreground",
  "Sad": "bg-warning/20 text-warning-foreground",
  "In danger": "bg-destructive/15 text-destructive",
  "Pending": "bg-muted text-muted-foreground",
};

function CallTree() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Call tree</h1>
          <p className="text-sm text-muted-foreground">Pair members, send call prompts, gather wellbeing feedback.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90">
          <Play className="h-3.5 w-3.5" /> Start new call tree
        </button>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Pairs created" value={callTreePairs.length} />
        <Stat label="Feedback received" value={callTreePairs.filter(p => p.status !== "Pending").length} />
        <Stat label="Awaiting" value={callTreePairs.filter(p => p.status === "Pending").length} />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Current cycle — May 2026</h2>
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">Live</span>
        </div>
        <ul className="divide-y divide-border">
          {callTreePairs.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex flex-1 items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">
                  {p.caller.split(" ").map(x=>x[0]).join("").slice(0,2)}
                </div>
                <PhoneCall className="h-4 w-4 text-muted-foreground" />
                <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                  {p.callee.split(" ").map(x=>x[0]).join("").slice(0,2)}
                </div>
                <div className="text-sm">
                  <p className="font-semibold">{p.caller} → {p.callee}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[p.status] ?? "bg-muted"}`}>{p.status}</span>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground md:max-w-xs">
                <MessageCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {p.comment}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
