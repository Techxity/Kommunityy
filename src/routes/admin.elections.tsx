import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { election as initialElection, members } from "@/lib/mock-data";
import { Vote, Plus, Trophy, RotateCcw, History, Crown, Pencil, X, Check, Users, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/elections")({
  component: Elections,
});

type Candidate = { name: string; votes: number };
type Position = { role: string; candidates: Candidate[] };
type ElectionRecord = {
  year: number;
  status: "Live" | "Ended";
  endsAt: string;
  positions: Position[];
};

const initialHistory: ElectionRecord[] = [
  {
    year: 2024,
    status: "Ended",
    endsAt: "2024-06-30",
    positions: [
      { role: "President", candidates: [{ name: "Adaeze Okafor", votes: 138 }, { name: "Femi Adeyemi", votes: 72 }] },
      { role: "Secretary", candidates: [{ name: "Chiamaka Eze", votes: 151 }, { name: "Amaka Ibe", votes: 54 }] },
      { role: "Treasurer", candidates: [{ name: "Tunde Bakare", votes: 130 }, { name: "Yusuf Bello", votes: 80 }] },
    ],
  },
  {
    year: 2022,
    status: "Ended",
    endsAt: "2022-06-30",
    positions: [
      { role: "President", candidates: [{ name: "Femi Adeyemi", votes: 120 }, { name: "Adaeze Okafor", votes: 95 }] },
      { role: "Secretary", candidates: [{ name: "Amaka Ibe", votes: 140 }, { name: "Chiamaka Eze", votes: 70 }] },
    ],
  },
];

const winnerOf = (p: Position) =>
  [...p.candidates].sort((a, b) => b.votes - a.votes)[0]?.name ?? "—";

function Elections() {
  const [election, setElection] = useState<ElectionRecord>(initialElection as ElectionRecord);
  const [history, setHistory] = useState<ElectionRecord[]>(initialHistory);
  const [roles, setRoles] = useState<string[]>(["President", "Secretary", "Treasurer", "PRO", "Welfare Officer"]);
  const [newRole, setNewRole] = useState("");
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showEditCandidates, setShowEditCandidates] = useState(false);

  const isLive = election.status === "Live";

  // Current executives = winners from most recent ended election
  const currentExecutives = useMemo(() => {
    const lastEnded = history.find((h) => h.status === "Ended");
    if (!lastEnded) return [];
    return lastEnded.positions.map((p) => ({ role: p.role, name: winnerOf(p), year: lastEnded.year }));
  }, [history]);

  const handleEndElection = () => {
    if (!window.confirm("End this election? Results will be final and the winners become the new executives.")) return;
    const ended: ElectionRecord = { ...election, status: "Ended" };
    setHistory((prev) => [ended, ...prev.filter((h) => h.year !== ended.year)]);
    setElection(ended);
    toast.success("Election ended. New executives confirmed.");
  };

  const handleRestartElection = () => {
    if (!window.confirm("Restart the election? Current results will be reset.")) return;
    const reset: ElectionRecord = {
      ...election,
      status: "Live",
      positions: election.positions.map((p) => ({ ...p, candidates: p.candidates.map((c) => ({ ...c, votes: 0 })) })),
    };
    setElection(reset);
    setHistory((prev) => prev.filter((h) => h.year !== reset.year));
    toast.success("Election restarted.");
  };

  const addRole = () => {
    const r = newRole.trim();
    if (!r) return;
    if (roles.includes(r)) {
      toast.error("Role already exists.");
      return;
    }
    setRoles((prev) => [...prev, r]);
    setNewRole("");
    toast.success(`Role "${r}" added.`);
  };

  const removeRole = (r: string) => {
    setRoles((prev) => prev.filter((x) => x !== r));
  };

  const startNewCycle = (year: number, endsAt: string, positions: Position[]) => {
    if (isLive) {
      toast.error("End the current election before starting a new cycle.");
      return;
    }
    setElection({ year, status: "Live", endsAt, positions });
    setShowNewCycle(false);
    toast.success(`${year} election cycle is now live.`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Elections</h1>
          <p className="text-sm text-muted-foreground">Run an election cycle. Only active members can vote — once per cycle.</p>
        </div>
        <button
          onClick={() => setShowNewCycle(true)}
          disabled={isLive}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          title={isLive ? "End the current election to start a new cycle" : "Start a new cycle"}
        >
          <Plus className="h-4 w-4" /> New election cycle
        </button>
      </header>

      {/* Current cycle banner */}
      <div className="rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Current cycle</p>
            <h2 className="mt-1 font-display text-3xl font-bold">{election.year} Executive Council</h2>
            <p className="mt-1 text-sm text-primary-foreground/70">Ends {election.endsAt} · 231 eligible voters</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              isLive ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {election.status}
          </span>
        </div>
      </div>

      {/* Live results */}
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

      {/* Action bar — hide Edit candidates while live */}
      <div className="flex flex-wrap gap-2">
        {!isLive && (
          <button
            onClick={() => setShowEditCandidates(true)}
            className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold"
          >
            Edit candidates
          </button>
        )}
        {isLive ? (
          <button
            onClick={handleEndElection}
            className="rounded-full border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
          >
            End election
          </button>
        ) : (
          <button
            onClick={handleRestartElection}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold transition hover:bg-secondary/80"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart election
          </button>
        )}
      </div>

      {/* Current executives */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-warning" />
          <h2 className="font-display text-xl font-semibold">Current executives</h2>
        </div>
        {currentExecutives.length === 0 ? (
          <p className="text-sm text-muted-foreground">No executives recorded yet. End an election to confirm winners.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {currentExecutives.map((e) => (
              <div key={e.role} className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{e.role}</p>
                <p className="mt-1 font-display text-lg font-semibold">{e.name}</p>
                <p className="text-xs text-muted-foreground">Elected {e.year}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Roles open for election */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="font-display text-xl font-semibold">Roles open for election</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Define the roles members can run for. These appear when you start a new cycle.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {roles.map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm font-medium">
              {r}
              <button onClick={() => removeRole(r)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {roles.length === 0 && <p className="text-sm text-muted-foreground">No roles yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRole()}
            placeholder="e.g. Vice President"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button onClick={addRole} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Add role
          </button>
        </div>
      </section>

      {/* Election history */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">Election history</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past elections yet.</p>
        ) : (
          <div className="space-y-4">
            {history.map((h) => (
              <div key={h.year} className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold">{h.year} Executive Council</p>
                    <p className="text-xs text-muted-foreground">Concluded {h.endsAt}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {h.status}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {h.positions.map((p) => {
                    const total = p.candidates.reduce((s, c) => s + c.votes, 0);
                    const w = [...p.candidates].sort((a, b) => b.votes - a.votes)[0];
                    return (
                      <div key={p.role} className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.role}</p>
                        <p className="font-semibold">{w?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {w?.votes ?? 0} of {total} votes
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showNewCycle && (
        <NewCycleModal
          roles={roles}
          memberOptions={members.filter((m) => m.status === "active").map((m) => m.name)}
          onClose={() => setShowNewCycle(false)}
          onCreate={startNewCycle}
        />
      )}

      {showEditCandidates && !isLive && (
        <EditCandidatesModal
          election={election}
          memberOptions={members.filter((m) => m.status === "active").map((m) => m.name)}
          onClose={() => setShowEditCandidates(false)}
          onSave={(positions) => {
            setElection((prev) => ({ ...prev, positions }));
            setShowEditCandidates(false);
            toast.success("Candidates updated.");
          }}
        />
      )}
    </div>
  );
}

function NewCycleModal({
  roles,
  memberOptions,
  onClose,
  onCreate,
}: {
  roles: string[];
  memberOptions: string[];
  onClose: () => void;
  onCreate: (year: number, endsAt: string, positions: Position[]) => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [endsAt, setEndsAt] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const toggleRole = (role: string) => {
    setSelected((prev) => {
      const copy = { ...prev };
      if (copy[role]) delete copy[role];
      else copy[role] = [];
      return copy;
    });
  };

  const toggleCandidate = (role: string, name: string) => {
    setSelected((prev) => {
      const list = prev[role] ?? [];
      return {
        ...prev,
        [role]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name],
      };
    });
  };

  const submit = () => {
    if (!endsAt) return toast.error("Pick an end date.");
    const positions: Position[] = Object.entries(selected)
      .filter(([, names]) => names.length > 0)
      .map(([role, names]) => ({ role, candidates: names.map((n) => ({ name: n, votes: 0 })) }));
    if (positions.length === 0) return toast.error("Select at least one role with candidates.");
    onCreate(year, endsAt, positions);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Start new election cycle</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cycle year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voting ends</span>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Select roles and candidates</p>
          <div className="space-y-3">
            {roles.map((role) => {
              const open = role in selected;
              return (
                <div key={role} className="rounded-xl border border-border bg-background p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={open} onChange={() => toggleRole(role)} />
                    {role}
                  </label>
                  {open && (
                    <CandidatePicker
                      memberOptions={memberOptions}
                      selected={selected[role] ?? []}
                      onToggle={(name) => toggleCandidate(role, name)}
                    />
                  )}
                </div>
              );
            })}
            {roles.length === 0 && (
              <p className="text-sm text-muted-foreground">Add roles first under "Roles open for election".</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={submit} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Start cycle
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCandidatesModal({
  election,
  memberOptions,
  onClose,
  onSave,
}: {
  election: ElectionRecord;
  memberOptions: string[];
  onClose: () => void;
  onSave: (positions: Position[]) => void;
}) {
  const [positions, setPositions] = useState<Position[]>(
    election.positions.map((p) => ({ ...p, candidates: p.candidates.map((c) => ({ ...c })) }))
  );

  const toggle = (role: string, name: string) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.role !== role) return p;
        const exists = p.candidates.find((c) => c.name === name);
        return {
          ...p,
          candidates: exists ? p.candidates.filter((c) => c.name !== name) : [...p.candidates, { name, votes: 0 }],
        };
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            <h2 className="font-display text-2xl font-bold">Edit candidates</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {positions.map((p) => (
            <div key={p.role} className="rounded-xl border border-border bg-background p-3">
              <p className="mb-2 text-sm font-semibold">{p.role}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {memberOptions.map((name) => {
                  const picked = p.candidates.some((c) => c.name === name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggle(p.role, name)}
                      className={`flex items-center justify-between gap-1 rounded-full border px-3 py-1 text-xs transition ${
                        picked ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      {picked && <Check className="h-3 w-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={() => onSave(positions)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
