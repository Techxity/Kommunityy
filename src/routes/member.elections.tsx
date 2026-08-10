import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Vote, Loader2, Trophy, History, ChevronDown } from "lucide-react";
import { getMyBallot, getMyElectionHistory, submitBallot } from "@/lib/membership/elections.functions";

export const Route = createFileRoute("/member/elections")({
  component: MemberElections,
});

type Ballot = Awaited<ReturnType<typeof getMyBallot>>;
type ElectionHistory = Awaited<ReturnType<typeof getMyElectionHistory>>;

function MemberElections() {
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [history, setHistory] = useState<ElectionHistory>([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function refreshHistory() {
    getMyElectionHistory().then(setHistory).catch(() => {});
  }

  useEffect(() => {
    getMyBallot()
      .then(setBallot)
      .finally(() => setLoading(false));
    refreshHistory();
  }, []);

  function vote(positionId: string, candidateId: string) {
    if (submitted) return;
    setVotes((v) => ({ ...v, [positionId]: candidateId }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      await submitBallot({ data: { votes } });
      setSubmitted(true);
      refreshHistory();
    } catch {
      // leave the form open so they can retry
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const pastElections = history.filter((e) => e.status === "ended");

  if (!ballot) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold">Elections</h1>
          <p className="text-sm text-muted-foreground">Vote for your community's next leadership.</p>
        </header>
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Voting isn't available yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You need an active membership to vote. Reach out to your community admin if this seems wrong.
          </p>
        </div>
        <PastElections elections={pastElections} />
      </div>
    );
  }

  if (!ballot.election) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold">Elections</h1>
          <p className="text-sm text-muted-foreground">Vote for your community's next leadership.</p>
        </header>
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No election is running right now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check back once your admin starts a new election cycle.
          </p>
        </div>
        <PastElections elections={pastElections} />
      </div>
    );
  }

  const alreadyVotedPositions = ballot.positions.filter((p) => p.myVote).length;
  const selectedCount = Object.keys(votes).length + alreadyVotedPositions;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Election cycle {ballot.election.year}</h1>
          <p className="text-sm text-muted-foreground">Closes {ballot.election.endsAt}. You may vote once per role.</p>
        </div>
        <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">{ballot.election.status}</span>
      </header>

      <div className="space-y-4">
        {ballot.positions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No positions are open yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Your admin hasn't added roles to this cycle yet.</p>
          </div>
        )}
        {ballot.positions.map((p) => {
          const locked = !!p.myVote;
          const pending = votes[p.id];
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Vote className="h-4 w-4 text-accent" /> {p.role}
                </h2>
                {locked && <p className="text-xs font-medium text-success">Vote recorded</p>}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {p.candidates.map((c) => {
                  const selected = locked ? p.myVote === c.id : pending === c.id;
                  return (
                    <button
                      key={c.id}
                      disabled={locked || submitted}
                      onClick={() => vote(p.id, c.id)}
                      className={`group relative overflow-hidden rounded-xl border p-4 text-left transition ${
                        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      } ${locked || submitted ? "cursor-default" : ""}`}
                    >
                      <div className="relative flex items-center justify-between">
                        <p className="text-sm font-semibold">{c.name}</p>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </button>
                  );
                })}
                {p.candidates.length === 0 && <p className="text-sm text-muted-foreground">No candidates yet.</p>}
              </div>
            </div>
          );
        })}
      </div>

      {ballot.positions.length > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-elegant">
          <p className="text-sm text-muted-foreground">{selectedCount} of {ballot.positions.length} roles selected</p>
          <button
            disabled={submitted || submitting || Object.keys(votes).length === 0}
            onClick={submit}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {submitted ? "✓ Vote submitted" : submitting ? "Submitting…" : "Submit my vote"}
          </button>
        </div>
      )}

      <PastElections elections={pastElections} />
    </div>
  );
}

function PastElections({ elections }: { elections: ElectionHistory }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (elections.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-xl font-semibold">Past elections</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Final results and who you voted for, by cycle.</p>
      <div className="space-y-3">
        {elections.map((e) => {
          const open = openId === e.id;
          return (
            <div key={e.id} className="rounded-xl border border-border bg-background">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div>
                  <p className="font-display text-base font-semibold">{e.year} Election cycle</p>
                  <p className="text-xs text-muted-foreground">Concluded {e.endsAt}</p>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="space-y-3 border-t border-border p-4 pt-3">
                  {e.positions.map((p) => {
                    const total = p.candidates.reduce((s, c) => s + (c.votes ?? 0), 0);
                    const sorted = [...p.candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
                    return (
                      <div key={p.id} className="rounded-lg border border-border/60 bg-card p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.role}</p>
                          {p.myVoteName && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                              You voted: {p.myVoteName}
                            </span>
                          )}
                        </div>
                        <ul className="mt-2 space-y-2">
                          {sorted.map((c, i) => {
                            const pct = total ? Math.round(((c.votes ?? 0) / total) * 100) : 0;
                            return (
                              <li key={c.id}>
                                <div className="flex items-center justify-between text-sm">
                                  <span className={`flex items-center gap-1.5 ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}>
                                    {i === 0 && <Trophy className="h-3 w-3 text-warning" />}
                                    {c.name}
                                  </span>
                                  <span className="text-xs font-semibold">{pct}% · {c.votes ?? 0}</span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                  <div className={`h-full ${i === 0 ? "bg-gradient-accent" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                                </div>
                              </li>
                            );
                          })}
                          {sorted.length === 0 && <p className="text-xs text-muted-foreground">No candidates ran for this role.</p>}
                        </ul>
                      </div>
                    );
                  })}
                  {e.positions.length === 0 && <p className="text-sm text-muted-foreground">No positions were open this cycle.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
