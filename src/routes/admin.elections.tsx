import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Vote, Plus, Trophy, RotateCcw, History, Crown, Pencil, X, Check, Users, Search } from "lucide-react";
import { toast } from "sonner";
import {
  getElectionsAdminData,
  saveElectionRoles,
  startElectionCycle,
  endElection,
  restartElection,
  updateCandidates,
} from "@/lib/membership/elections.functions";

export const Route = createFileRoute("/admin/elections")({
  component: Elections,
});

type MemberOption = { id: string; name: string };
type Candidate = { id: string; memberId: string; name: string; votes: number };
type Position = { id: string; role: string; candidates: Candidate[] };
type ElectionRecord = { id: string; year: number; status: "live" | "ended"; endsAt: string; positions: Position[] };

const winnerOf = (p: Position) => [...p.candidates].sort((a, b) => b.votes - a.votes)[0]?.name ?? "—";

function Elections() {
  const [election, setElection] = useState<ElectionRecord | null>(null);
  const [history, setHistory] = useState<ElectionRecord[]>([]);
  const [currentExecutives, setCurrentExecutives] = useState<{ role: string; name: string; year: number }[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [newRole, setNewRole] = useState("");
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showEditCandidates, setShowEditCandidates] = useState(false);
  const [loading, setLoading] = useState(true);

  function refresh() {
    getElectionsAdminData().then((d) => {
      setElection(d.election as ElectionRecord | null);
      setHistory(d.history as ElectionRecord[]);
      setCurrentExecutives(d.currentExecutives);
      setRoles(d.roles);
      setMemberOptions(d.memberOptions);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const isLive = election?.status === "live";

  const handleEndElection = async () => {
    if (!election) return;
    if (!window.confirm("End this election? Results will be final and the winners become the new executives.")) return;
    await endElection({ data: { electionId: election.id } });
    refresh();
    toast.success("Election ended. New executives confirmed.");
  };

  const handleRestartElection = async () => {
    if (!election) return;
    if (!window.confirm("Restart the election? Current votes will be reset.")) return;
    await restartElection({ data: { electionId: election.id } });
    refresh();
    toast.success("Election restarted.");
  };

  const addRole = async () => {
    const r = newRole.trim();
    if (!r) return;
    if (roles.includes(r)) {
      toast.error("Role already exists.");
      return;
    }
    const next = [...roles, r];
    setRoles(next);
    setNewRole("");
    await saveElectionRoles({ data: { roles: next } });
    toast.success(`Role "${r}" added.`);
  };

  const removeRole = async (r: string) => {
    const next = roles.filter((x) => x !== r);
    setRoles(next);
    await saveElectionRoles({ data: { roles: next } });
  };

  const startNewCycle = async (year: number, endsAt: string, positions: { role: string; memberIds: string[] }[]) => {
    if (isLive) {
      toast.error("End the current election before starting a new cycle.");
      return;
    }
    try {
      await startElectionCycle({ data: { year, endsAt, positions } });
      setShowNewCycle(false);
      refresh();
      toast.success(`${year} election cycle is now live.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't start the election cycle.");
    }
  };

  if (loading) return <div className="min-h-40" />;

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

      <div className="rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Current cycle</p>
            <h2 className="mt-1 font-display text-3xl font-bold">{election ? `${election.year} Executive Council` : "No election yet"}</h2>
            <p className="mt-1 text-sm text-primary-foreground/70">
              {election?.endsAt ? `Ends ${election.endsAt}` : "No election running"} · {memberOptions.length} eligible voters
            </p>
          </div>
          {election && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                isLive ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {election.status}
            </span>
          )}
        </div>
      </div>

      {election && election.positions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {election.positions.map((p) => {
            const total = p.candidates.reduce((s, c) => s + c.votes, 0);
            const sorted = [...p.candidates].sort((a, b) => b.votes - a.votes);
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
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
                      <li key={c.id}>
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
      )}

      {election && (
        <div className="flex flex-wrap gap-2">
          {!isLive && (
            <button onClick={() => setShowEditCandidates(true)} className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold">
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
      )}

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
              <div key={h.id} className="rounded-xl border border-border bg-background p-4">
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
                      <div key={p.id} className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm">
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
          memberOptions={memberOptions}
          onClose={() => setShowNewCycle(false)}
          onCreate={startNewCycle}
        />
      )}

      {showEditCandidates && election && !isLive && (
        <EditCandidatesModal
          election={election}
          memberOptions={memberOptions}
          onClose={() => setShowEditCandidates(false)}
          onSave={async (positions) => {
            await updateCandidates({ data: { electionId: election.id, positions } });
            setShowEditCandidates(false);
            refresh();
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
  memberOptions: MemberOption[];
  onClose: () => void;
  onCreate: (year: number, endsAt: string, positions: { role: string; memberIds: string[] }[]) => void;
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

  const toggleCandidate = (role: string, memberId: string) => {
    setSelected((prev) => {
      const list = prev[role] ?? [];
      return {
        ...prev,
        [role]: list.includes(memberId) ? list.filter((n) => n !== memberId) : [...list, memberId],
      };
    });
  };

  const submit = () => {
    if (!endsAt) return toast.error("Pick an end date.");
    const positions = Object.entries(selected)
      .filter(([, ids]) => ids.length > 0)
      .map(([role, memberIds]) => ({ role, memberIds }));
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
                      onToggle={(id) => toggleCandidate(role, id)}
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
  memberOptions: MemberOption[];
  onClose: () => void;
  onSave: (positions: { positionId: string; memberIds: string[] }[]) => void;
}) {
  const [byPosition, setByPosition] = useState<Record<string, string[]>>(
    Object.fromEntries(election.positions.map((p) => [p.id, p.candidates.map((c) => c.memberId)])),
  );

  const toggle = (positionId: string, memberId: string) => {
    setByPosition((prev) => {
      const list = prev[positionId] ?? [];
      return {
        ...prev,
        [positionId]: list.includes(memberId) ? list.filter((id) => id !== memberId) : [...list, memberId],
      };
    });
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
          {election.positions.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-background p-3">
              <p className="mb-2 text-sm font-semibold">{p.role}</p>
              <CandidatePicker
                memberOptions={memberOptions}
                selected={byPosition[p.id] ?? []}
                onToggle={(id) => toggle(p.id, id)}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
          <button
            onClick={() => onSave(Object.entries(byPosition).map(([positionId, memberIds]) => ({ positionId, memberIds })))}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidatePicker({
  memberOptions,
  selected,
  onToggle,
}: {
  memberOptions: MemberOption[];
  selected: string[];
  onToggle: (memberId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const nameById = useMemo(() => new Map(memberOptions.map((m) => [m.id, m.name])), [memberOptions]);
  const q = query.trim().toLowerCase();
  const matches = q
    ? memberOptions.filter((m) => m.name.toLowerCase().includes(q) && !selected.includes(m.id)).slice(0, 6)
    : [];

  return (
    <div className="mt-3 space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium">
              {nameById.get(id) ?? "Unknown member"}
              <button type="button" onClick={() => onToggle(id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search member by name…"
          className="w-full rounded-lg border border-border bg-card px-3 py-1.5 pl-8 text-xs outline-none focus:border-primary"
        />
        {focused && q && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-elegant">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
            ) : (
              matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onToggle(m.id);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  <span>{m.name}</span>
                  <Check className="h-3 w-3 text-primary opacity-0" />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
