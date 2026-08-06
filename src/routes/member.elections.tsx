import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Vote, Loader2 } from "lucide-react";
import { getMyBallot, submitBallot } from "@/lib/membership/elections.functions";

export const Route = createFileRoute("/member/elections")({
  component: MemberElections,
});

type Ballot = Awaited<ReturnType<typeof getMyBallot>>;

function MemberElections() {
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getMyBallot()
      .then(setBallot)
      .finally(() => setLoading(false));
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
    } catch {
      // leave the form open so they can retry
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!ballot) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Voting isn't available on your account yet — you need an active membership to vote.
        </p>
      </div>
    );
  }

  if (!ballot.election) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No election is running right now.</p>
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
          <p className="text-sm text-muted-foreground">No positions are open for this cycle yet.</p>
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
    </div>
  );
}
