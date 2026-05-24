import { createFileRoute } from "@tanstack/react-router";
import { election } from "@/lib/mock-data";
import { Vote, Plus, Trophy } from "lucide-react";

export const Route = createFileRoute("/admin/elections")({
  component: Elections,
});

function Elections() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Elections</h1>
          <p className="text-sm text-muted-foreground">Run an election cycle. Only active members can vote — once per cycle.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90">
          <Plus className="h-4 w-4" /> New election cycle
        </button>
      </header>

      <div className="rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Current cycle</p>
            <h2 className="mt-1 font-display text-3xl font-bold">{election.year} Executive Council</h2>
            <p className="mt-1 text-sm text-primary-foreground/70">Ends {election.endsAt} · 231 eligible voters</p>
          </div>
          <span className="rounded-full bg-success px-3 py-1 text-xs font-bold uppercase tracking-wider text-success-foreground">{election.status}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {election.positions.map((p) => {
          const total = p.candidates.reduce((s, c) => s + c.votes, 0);
          const sorted = [...p.candidates].sort((a, b) => b.votes - a.votes);
          return (
            <div key={p.role} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Vote className="h-4 w-4 text-accent" />
                  <h3 className="font-display text-lg font-semibold">{p.role}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{total} votes</span>
              </div>
              <ul className="mt-5 space-y-3">
                {sorted.map((c, i) => {
                  const pct = total ? Math.round((c.votes / total) * 100) : 0;
                  return (
                    <li key={c.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className={`flex items-center gap-1.5 font-medium ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {i === 0 && <Trophy className="h-3 w-3 text-warning" />}
                          {c.name}
                        </span>
                        <span className="text-xs font-semibold">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${i === 0 ? "bg-gradient-accent" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold">Edit candidates</button>
        <button className="rounded-full border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive">End election</button>
      </div>
    </div>
  );
}
