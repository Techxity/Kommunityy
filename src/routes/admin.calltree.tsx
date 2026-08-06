import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Play, Shuffle, Download, Mail, Trash2, ArrowLeft, PhoneCall, MessageCircle,
  CheckCircle2, AlertTriangle, HelpCircle, Phone, RefreshCw, Lock, Plus,
} from "lucide-react";
import { members } from "@/lib/mock-data";
import { listMyChapters } from "@/lib/membership/chapters.functions";
import {
  callTreeStore,
  useCallTreeSessions,
  type CallTreeSession,
  type Pairing,
  type FeedbackStatus,
} from "@/lib/call-tree-store";

export const Route = createFileRoute("/admin/calltree")({
  component: CallTreePage,
});

const memberById = (id: string) => members.find((m) => m.id === id);
const initials = (name?: string) =>
  (name ?? "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const STATUS_META: Record<FeedbackStatus, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  doing_great: { label: "Doing Great", tone: "bg-success/15 text-success", Icon: CheckCircle2 },
  not_sure: { label: "Not Sure", tone: "bg-warning/20 text-warning-foreground", Icon: HelpCircle },
  needs_help: { label: "Needs Help", tone: "bg-destructive/15 text-destructive", Icon: AlertTriangle },
};

function CallTreePage() {
  const sessions = useCallTreeSessions();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = activeId ? sessions.find((s) => s.id === activeId) ?? null : null;

  if (active) return <SessionDetail session={active} onBack={() => setActiveId(null)} />;

  return <SessionList sessions={sessions} onOpen={setActiveId} />;
}

function SessionList({
  sessions,
  onOpen,
}: {
  sessions: CallTreeSession[];
  onOpen: (id: string) => void;
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
          {sessions.map((s) => {
            const total = s.pairings.reduce(
              (n, p) => n + 2 + (p.memberCId ? 1 : 0),
              0,
            );
            const fb = s.pairings.reduce(
              (n, p) =>
                n + (p.feedbackA ? 1 : 0) + (p.feedbackB ? 1 : 0) + (p.feedbackC ? 1 : 0),
              0,
            );
            const needsHelp = s.pairings.reduce(
              (n, p) =>
                n +
                ([p.feedbackA, p.feedbackB, p.feedbackC].filter(
                  (f) => f?.status === "needs_help",
                ).length),
              0,
            );
            return (
              <li
                key={s.id}
                className="cursor-pointer rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-md"
                onClick={() => onOpen(s.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()} · {s.pairings.length} pairs · {total} members
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    {fb}/{total} responded
                  </span>
                  {needsHelp > 0 && (
                    <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive">
                      {needsHelp} need{needsHelp === 1 ? "s" : ""} help
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && <CreateSessionModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: CallTreeSession["status"] }) {
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

function CreateSessionModal({ onClose }: { onClose: () => void }) {
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    listMyChapters().then((rows) => setChapters(rows.map((c) => ({ id: c.id, name: c.name }))));
  }, []);
  const [name, setName] = useState(
    `Call tree — ${new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" })}`,
  );
  const [chapterId, setChapterId] = useState<string>("");
  const eligible = useMemo(
    () => members.filter((m) => m.status === "active"),
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(eligible.map((m) => m.id)),
  );
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (selected.size < 2) return;
    callTreeStore.create({
      name: name.trim() || "Call tree",
      chapterId: chapterId || undefined,
      memberIds: Array.from(selected),
    });
    onClose();
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
          </ul>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={selected.size < 2}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Shuffle className="h-3.5 w-3.5" /> Generate pairs
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionDetail({
  session,
  onBack,
}: {
  session: CallTreeSession;
  onBack: () => void;
}) {
  const isDraft = session.status === "draft";
  const isActive = session.status === "active";

  const totalParticipants = session.pairings.reduce(
    (n, p) => n + 2 + (p.memberCId ? 1 : 0),
    0,
  );
  const responses = session.pairings.flatMap((p) =>
    [p.feedbackA, p.feedbackB, p.feedbackC].filter(Boolean),
  );

  const needsHelp = session.pairings.flatMap((p) =>
    [
      p.feedbackA && p.feedbackA.status === "needs_help" ? { p, memberId: p.memberAId, fb: p.feedbackA } : null,
      p.feedbackB && p.feedbackB.status === "needs_help" ? { p, memberId: p.memberBId, fb: p.feedbackB } : null,
      p.feedbackC && p.memberCId && p.feedbackC.status === "needs_help" ? { p, memberId: p.memberCId, fb: p.feedbackC } : null,
    ].filter(Boolean) as Array<{ p: Pairing; memberId: string; fb: NonNullable<Pairing["feedbackA"]> }>,
  );

  const downloadCsv = () => {
    const rows: string[][] = [["Member", "Email", "Phone", "Partner(s)", "Partner contacts", "Feedback link"]];
    session.pairings.forEach((p) => {
      const a = memberById(p.memberAId);
      const b = memberById(p.memberBId);
      const c = p.memberCId ? memberById(p.memberCId) : null;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const partnersFor = (selfId: string) =>
        [a, b, c]
          .filter((m): m is NonNullable<typeof m> => !!m && m.id !== selfId)
          .map((m) => m.name)
          .join(" & ");
      const contactsFor = (selfId: string) =>
        [a, b, c]
          .filter((m): m is NonNullable<typeof m> => !!m && m.id !== selfId)
          .map((m) => `${m.email} / ${m.phone}`)
          .join(" | ");

      if (a) rows.push([a.name, a.email, a.phone, partnersFor(a.id), contactsFor(a.id), `${origin}/feedback/${p.tokenA}`]);
      if (b) rows.push([b.name, b.email, b.phone, partnersFor(b.id), contactsFor(b.id), `${origin}/feedback/${p.tokenB}`]);
      if (c && p.tokenC) rows.push([c.name, c.email, c.phone, partnersFor(c.id), contactsFor(c.id), `${origin}/feedback/${p.tokenC}`]);
    });
    const csv = rows
      .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
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
            {session.pairings.length} pairs · {totalParticipants} members · created {new Date(session.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <button
              onClick={() =>
                callTreeStore.regenerate(
                  session.id,
                  session.pairings.flatMap((p) =>
                    [p.memberAId, p.memberBId, p.memberCId].filter(Boolean) as string[],
                  ),
                )
              }
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
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
              onClick={() => callTreeStore.activate(session.id)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Mail className="h-3.5 w-3.5" /> Activate & email pairs
            </button>
          )}
          {isActive && (
            <button
              onClick={() => callTreeStore.close(session.id)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              <Lock className="h-3.5 w-3.5" /> Close session
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Pairs" value={session.pairings.length} />
        <Stat label="Responses" value={`${responses.length}/${totalParticipants}`} />
        <Stat
          label="Doing great"
          value={responses.filter((f) => f?.status === "doing_great").length}
        />
        <Stat
          label="Needs help"
          value={needsHelp.length}
          tone={needsHelp.length > 0 ? "destructive" : undefined}
        />
      </div>

      {needsHelp.length > 0 && (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="font-display text-lg font-bold text-destructive">Needs follow-up</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {needsHelp.map(({ p, memberId, fb }, i) => {
              const m = memberById(memberId);
              if (!m) return null;
              return (
                <li
                  key={`${p.id}-${i}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-background p-3"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-destructive/15 text-xs font-bold text-destructive">
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-40">
                    <p className="text-sm font-semibold">{m.name}</p>
                    {fb.notes && (
                      <p className="text-xs text-muted-foreground">"{fb.notes}"</p>
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
              );
            })}
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

function PairingRow({
  pairing,
  sessionStatus,
}: {
  pairing: Pairing;
  sessionStatus: CallTreeSession["status"];
}) {
  const a = memberById(pairing.memberAId);
  const b = memberById(pairing.memberBId);
  const c = pairing.memberCId ? memberById(pairing.memberCId) : null;
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <MemberChip name={a?.name} />
        <PhoneCall className="h-4 w-4 text-muted-foreground" />
        <MemberChip name={b?.name} />
        {c && (
          <>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
            <MemberChip name={c.name} />
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
        <FeedbackPill member={a} fb={pairing.feedbackA} token={pairing.tokenA} active={sessionStatus !== "draft"} />
        <FeedbackPill member={b} fb={pairing.feedbackB} token={pairing.tokenB} active={sessionStatus !== "draft"} />
        {c && pairing.tokenC && (
          <FeedbackPill member={c} fb={pairing.feedbackC} token={pairing.tokenC} active={sessionStatus !== "draft"} />
        )}
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

function FeedbackPill({
  member,
  fb,
  token,
  active,
}: {
  member: ReturnType<typeof memberById>;
  fb?: NonNullable<Pairing["feedbackA"]>;
  token: string;
  active: boolean;
}) {
  if (!member) return null;
  if (!fb) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">{member.name.split(" ")[0]}</span>
        {active ? (
          <Link to="/feedback/$token" params={{ token }} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            preview link
          </Link>
        ) : (
          <span className="ml-auto">waiting for activation</span>
        )}
      </div>
    );
  }
  const meta = STATUS_META[fb.status];
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${meta.tone}`}>
      <meta.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{member.name.split(" ")[0]} · {meta.label}</p>
        {fb.notes && (
          <p className="mt-0.5 flex items-start gap-1 text-[11px] opacity-80">
            <MessageCircle className="mt-0.5 h-3 w-3 shrink-0" /> {fb.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "destructive";
}) {
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
