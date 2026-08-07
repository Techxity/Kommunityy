import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Play, Shuffle, Download, Mail, ArrowLeft, PhoneCall, MessageCircle,
  CheckCircle2, AlertTriangle, HelpCircle, Phone, RefreshCw, Lock, Loader2,
} from "lucide-react";
import { listMembers } from "@/lib/membership/members.functions";
import { listMyChapters } from "@/lib/membership/chapters.functions";
import {
  listCallTreeSessions,
  getCallTreeSession,
  createCallTreeSession,
  regenerateCallTreePairings,
  activateCallTreeSession,
  closeCallTreeSession,
} from "@/lib/membership/calltree.functions";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/calltree")({
  beforeLoad: () => requireModule("Call Tree"),
  component: CallTreePage,
});

type SessionSummary = Awaited<ReturnType<typeof listCallTreeSessions>>[number];
type SessionDetail = Awaited<ReturnType<typeof getCallTreeSession>>;
type Pairing = NonNullable<SessionDetail>["pairings"][number];
type Slot = Pairing["a"];
type FeedbackStatus = "doing_great" | "not_sure" | "needs_help";

const initials = (name?: string) =>
  (name ?? "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const STATUS_META: Record<FeedbackStatus, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  doing_great: { label: "Doing Great", tone: "bg-success/15 text-success", Icon: CheckCircle2 },
  not_sure: { label: "Not Sure", tone: "bg-warning/20 text-warning-foreground", Icon: HelpCircle },
  needs_help: { label: "Needs Help", tone: "bg-destructive/15 text-destructive", Icon: AlertTriangle },
};

function CallTreePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    listCallTreeSessions().then(setSessions).finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  if (activeId) {
    return <SessionDetailView sessionId={activeId} onBack={() => { setActiveId(null); refresh(); }} />;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return <SessionList sessions={sessions} onOpen={setActiveId} onCreated={refresh} />;
}

function SessionList({
  sessions,
  onOpen,
  onCreated,
}: {
  sessions: SessionSummary[];
  onOpen: (id: string) => void;
  onCreated: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Call tree</h1>
          <p className="text-sm text-muted-foreground">
            Pair members for wellbeing check-ins. Each pair gets an email with their partner's
            contact and a link to share how the call went.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5" /> Start new call tree
        </button>
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <PhoneCall className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-semibold">No call trees yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a new session to pair members and gather feedback.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="cursor-pointer rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-md"
              onClick={() => onOpen(s.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ""} · {s.pairCount} pairs · {s.totalMembers} members
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {s.responses}/{s.totalMembers} responded
                </span>
                {s.needsHelp > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive">
                    {s.needsHelp} need{s.needsHelp === 1 ? "s" : ""} help
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && <CreateSessionModal onClose={() => setShowCreate(false)} onCreated={onCreated} />}
    </div>
  );
}

function StatusBadge({ status }: { status: SessionSummary["status"] }) {
  const tone =
    status === "active"
      ? "bg-success/15 text-success"
      : status === "closed"
      ? "bg-muted text-muted-foreground"
      : "bg-warning/20 text-warning-foreground";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>
  );
}

function CreateSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [eligible, setEligible] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyChapters().then((rows) => setChapters(rows.map((c) => ({ id: c.id, name: c.name }))));
    listMembers({ data: { status: "active" } }).then((rows) => {
      const active = rows.map((m) => ({ id: m.id, name: m.name, email: m.email }));
      setEligible(active);
      setSelected(new Set(active.map((m) => m.id)));
      setLoadingMembers(false);
    });
  }, []);

  const [name, setName] = useState(
    `Call tree — ${new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" })}`,
  );
  const [chapterId, setChapterId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size < 2) return;
    setSubmitting(true);
    setError("");
    try {
      await createCallTreeSession({
        data: { name: name.trim() || "Call tree", chapterId: chapterId || undefined, memberIds: Array.from(selected) },
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't create this call tree.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl border border-border bg-card p-7 shadow-elegant"
      >
        <h3 className="font-display text-xl font-bold">Start a new call tree</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick members to include. We'll randomly pair them — if there's an odd one out,
          they'll be added to the last pair as a triad.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapter (optional)</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="">All chapters</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Members ({selected.size}/{eligible.length})
            </p>
            <button
              onClick={() =>
                setSelected(
                  selected.size === eligible.length ? new Set() : new Set(eligible.map((m) => m.id)),
                )
              }
              className="text-xs font-semibold text-primary hover:underline"
            >
              {selected.size === eligible.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          {loadingMembers ? (
            <div className="mt-2 flex items-center justify-center rounded-xl border border-border p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {eligible.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                      <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} />
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-accent text-[10px] font-bold text-primary-foreground">
                        {initials(m.name)}
                      </div>
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{m.email}</span>
                    </label>
                  </li>
                );
              })}
              {eligible.length === 0 && (
                <p className="p-3 text-center text-sm text-muted-foreground">No active members yet.</p>
              )}
            </ul>
          )}
        </div>

        {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={selected.size < 2 || submitting}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Shuffle className="h-3.5 w-3.5" /> {submitting ? "Creating…" : "Generate pairs"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionDetailView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [session, setSession] = useState<SessionDetail>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function refresh() {
    getCallTreeSession({ data: { sessionId } }).then((s) => {
      setSession(s);
      setLoading(false);
    });
  }
  useEffect(refresh, [sessionId]);

  if (loading || !session) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const isDraft = session.status === "draft";
  const isActive = session.status === "active";

  const totalParticipants = session.pairings.reduce((n, p) => n + 2 + (p.c ? 1 : 0), 0);
  const allFeedback = session.pairings.flatMap((p) => [p.a.feedback, p.b.feedback, p.c?.feedback].filter(Boolean));
  const needsHelp = session.pairings.flatMap((p) =>
    [p.a, p.b, p.c].filter((slot): slot is Slot => !!slot && slot.feedback?.status === "needs_help"),
  );

  async function reshuffle() {
    setBusy(true);
    try {
      await regenerateCallTreePairings({ data: { sessionId } });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    try {
      await activateCallTreeSession({ data: { sessionId } });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      await closeCallTreeSession({ data: { sessionId } });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const downloadCsv = () => {
    const rows: string[][] = [["Member", "Email", "Phone", "Partner(s)", "Partner contacts", "Feedback link"]];
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    session.pairings.forEach((p) => {
      const slots = [p.a, p.b, p.c].filter((s): s is Slot => !!s);
      slots.forEach((self) => {
        const partners = slots.filter((s) => s.id !== self.id);
        rows.push([
          self.name,
          self.email,
          self.phone,
          partners.map((m) => m.name).join(" & "),
          partners.map((m) => `${m.email} / ${m.phone}`).join(" | "),
          `${origin}/feedback/${self.token}`,
        ]);
      });
    });
    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.name.replace(/\s+/g, "-").toLowerCase()}-pairings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> All call trees
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{session.name}</h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.pairings.length} pairs · {totalParticipants} members
            {session.createdAt ? ` · created ${new Date(session.createdAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <button
              onClick={reshuffle}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reshuffle
            </button>
          )}
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Download CSV
          </button>
          {isDraft && (
            <button
              onClick={activate}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Activate & email pairs"}
            </button>
          )}
          {isActive && (
            <button
              onClick={close}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" /> Close session
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Pairs" value={session.pairings.length} />
        <Stat label="Responses" value={`${allFeedback.length}/${totalParticipants}`} />
        <Stat label="Doing great" value={allFeedback.filter((f) => f?.status === "doing_great").length} />
        <Stat label="Needs help" value={needsHelp.length} tone={needsHelp.length > 0 ? "destructive" : undefined} />
      </div>

      {needsHelp.length > 0 && (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="font-display text-lg font-bold text-destructive">Needs follow-up</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {needsHelp.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-background p-3"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-destructive/15 text-xs font-bold text-destructive">
                  {initials(m.name)}
                </div>
                <div className="flex-1 min-w-40">
                  <p className="text-sm font-semibold">{m.name}</p>
                  {m.feedback?.notes && (
                    <p className="text-xs text-muted-foreground">"{m.feedback.notes}"</p>
                  )}
                </div>
                <a
                  href={`tel:${m.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:opacity-95"
                >
                  <Phone className="h-3 w-3" /> Call
                </a>
                <a
                  href={`mailto:${m.email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Mail className="h-3 w-3" /> Email
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Pairings & feedback</h2>
        </div>
        <ul className="divide-y divide-border">
          {session.pairings.map((p) => (
            <PairingRow key={p.id} pairing={p} sessionStatus={session.status} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PairingRow({ pairing, sessionStatus }: { pairing: Pairing; sessionStatus: "draft" | "active" | "closed" }) {
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <MemberChip name={pairing.a.name} />
        <PhoneCall className="h-4 w-4 text-muted-foreground" />
        <MemberChip name={pairing.b.name} />
        {pairing.c && (
          <>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
            <MemberChip name={pairing.c.name} />
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              triad
            </span>
          </>
        )}
        {sessionStatus === "draft" && (
          <span className="ml-auto text-xs text-muted-foreground">Not emailed yet</span>
        )}
      </div>
      <div className="grid gap-2 pl-1 md:grid-cols-3">
        <FeedbackPill slot={pairing.a} active={sessionStatus !== "draft"} />
        <FeedbackPill slot={pairing.b} active={sessionStatus !== "draft"} />
        {pairing.c && <FeedbackPill slot={pairing.c} active={sessionStatus !== "draft"} />}
      </div>
    </li>
  );
}

function MemberChip({ name }: { name?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-muted/60 px-2 py-1">
      <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-accent text-[10px] font-bold text-primary-foreground">
        {initials(name)}
      </div>
      <span className="text-sm font-semibold">{name ?? "?"}</span>
    </div>
  );
}

function FeedbackPill({ slot, active }: { slot: Slot; active: boolean }) {
  if (!slot.feedback) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">{slot.name.split(" ")[0]}</span>
        {active ? (
          <Link to="/feedback/$token" params={{ token: slot.token }} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            preview link
          </Link>
        ) : (
          <span className="ml-auto">waiting for activation</span>
        )}
      </div>
    );
  }
  const meta = STATUS_META[slot.feedback.status as FeedbackStatus];
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${meta.tone}`}>
      <meta.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{slot.name.split(" ")[0]} · {meta.label}</p>
        {slot.feedback.notes && (
          <p className="mt-0.5 flex items-start gap-1 text-[11px] opacity-80">
            <MessageCircle className="mt-0.5 h-3 w-3 shrink-0" /> {slot.feedback.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "destructive" }) {
  return (
    <div
      className={`rounded-2xl border bg-card p-5 shadow-soft ${
        tone === "destructive" ? "border-destructive/40" : "border-border"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-display text-3xl font-bold ${
          tone === "destructive" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
