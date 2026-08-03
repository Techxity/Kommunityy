import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, AlertTriangle, PhoneCall, Mail, Phone } from "lucide-react";
import { members, community } from "@/lib/mock-data";
import { callTreeStore, type FeedbackStatus } from "@/lib/call-tree-store";

export const Route = createFileRoute("/feedback/$token")({
  component: FeedbackPage,
  head: () => ({
    meta: [{ title: "Share call feedback" }],
  }),
});

const OPTIONS: Array<{
  value: FeedbackStatus;
  label: string;
  description: string;
  Icon: typeof CheckCircle2;
  tone: string;
}> = [
  {
    value: "doing_great",
    label: "Doing Great",
    description: "They're in good spirits and don't need anything.",
    Icon: CheckCircle2,
    tone: "border-success/40 hover:border-success bg-success/5 text-success",
  },
  {
    value: "not_sure",
    label: "Not Sure",
    description: "Something feels off — worth a follow up.",
    Icon: HelpCircle,
    tone: "border-warning/40 hover:border-warning bg-warning/10 text-warning-foreground",
  },
  {
    value: "needs_help",
    label: "Needs Help",
    description: "Please reach out to them as soon as possible.",
    Icon: AlertTriangle,
    tone: "border-destructive/40 hover:border-destructive bg-destructive/5 text-destructive",
  },
];

function FeedbackPage() {
  const { token } = useParams({ from: "/feedback/$token" });
  const navigate = useNavigate();
  // Re-evaluate when the token / submission state changes.
  const [tick, setTick] = useState(0);
  const hit = useMemo(() => callTreeStore.findByToken(token), [token, tick]);

  const [status, setStatus] = useState<FeedbackStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // After a successful submit, send the member to the call tree history page.
  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => navigate({ to: "/member/calltree" }), 1500);
    return () => clearTimeout(t);
  }, [submitted, navigate]);

  if (!hit) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold">Link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This feedback link is invalid or has expired. Please check your email for the latest link.
        </p>
      </Shell>
    );
  }

  const { pairing, slot, memberId } = hit;
  const self = members.find((m) => m.id === memberId);
  const partnerIds = [pairing.memberAId, pairing.memberBId, pairing.memberCId].filter(
    (id): id is string => !!id && id !== memberId,
  );
  const partners = partnerIds.map((id) => members.find((m) => m.id === id)).filter(Boolean) as typeof members;

  const existing = slot === "A" ? pairing.feedbackA : slot === "B" ? pairing.feedbackB : pairing.feedbackC;

  if (submitted) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Thank you</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your feedback has been shared with the {community.name} admin team.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Taking you to your call tree history…</p>
        </div>
      </Shell>
    );
  }

  const submit = () => {
    if (!status) return;
    callTreeStore.submitFeedback(token, status, notes.trim() || undefined);
    setSubmitted(true);
    setTick((t) => t + 1);
  };

  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{community.name}</p>
      <h1 className="mt-1 font-display text-2xl font-bold">
        Hi {self?.name.split(" ")[0] ?? "there"} 👋
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Thanks for being part of our call tree. Please share how the call with your partner went.
      </p>

      <section className="mt-5 rounded-2xl border border-border bg-muted/40 p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          You were paired with
        </p>
        <ul className="mt-2 space-y-2">
          {partners.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">
                {p.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              <div className="ml-auto flex gap-1">
                <a href={`tel:${p.phone}`} className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground" aria-label="Call">
                  <Phone className="h-3.5 w-3.5" />
                </a>
                <a href={`mailto:${p.email}`} className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground" aria-label="Email">
                  <Mail className="h-3.5 w-3.5" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {existing && (
        <p className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
          You already shared feedback for this round — submitting again will update your response.
        </p>
      )}

      <h2 className="mt-6 font-display text-base font-semibold">How is your partner?</h2>
      <div className="mt-3 grid gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.Icon;
          const active = status === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
                active ? "border-current shadow-soft" : "border-border bg-card hover:border-primary/40"
              } ${active ? opt.tone : ""}`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? "" : "text-muted-foreground"}`} />
              <div>
                <p className="font-display text-sm font-bold">{opt.label}</p>
                <p className={`mt-0.5 text-xs ${active ? "" : "text-muted-foreground"}`}>
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Anything else to share? (optional)
      </label>
      <textarea
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything the admin team should know…"
        className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring"
      />

      <button
        onClick={submit}
        disabled={!status}
        className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
      >
        Share feedback
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-6 shadow-elegant md:p-8">
        <div className="mb-5 flex items-center gap-2 text-primary">
          <PhoneCall className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Call tree feedback</span>
        </div>
        {children}
      </div>
    </div>
  );
}
