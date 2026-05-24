import { createFileRoute } from "@tanstack/react-router";
import { election } from "@/lib/mock-data";
import { useState } from "react";
import { Check, Trophy, Vote } from "lucide-react";

export const Route = createFileRoute("/member/elections")({
  component: MemberElections,
});

function MemberElections() {
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function vote(role: string, name: string) {
    if (submitted) return;
    setVotes((v) => ({ ...v, [role]: name }));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Election cycle {election.year}</h1>
          <p className="text-sm text-muted-foreground">Closes {election.endsAt}. You may vote once per role.</p>
        </div>
        <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">{election.status}</span>
      </header>

      <div className="space-y-4">
        {election.positions.map((p) => {
          const total = p.candidates.reduce((s, c) => s + c.votes, 0);
          const leader = [...p.candidates].sort((a, b) => b.votes - a.votes)[0];
          return (
            <div key={p.role} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Vote className="h-4 w-4 text-accent" /> {p.role}
                </h2>
                <p className="text-xs text-muted-foreground">Leading: <span className="font-semibold text-foreground">{leader.name}</span></p>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {p.candidates.map((c) => {
                  const pct = total ? Math.round((c.votes / total) * 100) : 0;
                  const selected = votes[p.role] === c.name;
                  return (
                    <button
                      key={c.name}
                      onClick={() => vote(p.role, c.name)}
                      className={`group relative overflow-hidden rounded-xl border p-4 text-left transition ${
                        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="relative flex items-center justify-between">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-semibold">
                            {c.name === leader.name && <Trophy className="h-3 w-3 text-warning" />}
                            {c.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{c.votes} votes · {pct}%</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="absolute bottom-0 left-0 h-1 bg-gradient-accent" style={{ width: `${pct}%` }} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-elegant">
        <p className="text-sm text-muted-foreground">{Object.keys(votes).length} of {election.positions.length} roles selected</p>
        <button
          disabled={submitted || Object.keys(votes).length === 0}
          onClick={() => setSubmitted(true)}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {submitted ? "✓ Vote submitted" : "Submit my vote"}
        </button>
      </div>
    </div>
  );
}
