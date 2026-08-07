import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, HelpCircle, AlertTriangle, PhoneCall, Loader2 } from "lucide-react";
import { getMyCallTreeHistory } from "@/lib/membership/calltree.functions";

export const Route = createFileRoute("/member/calltree")({
  component: MemberCallTree,
  head: () => ({
    meta: [
      { title: "My Call Tree History — Kinfolk" },
      { name: "description", content: "See every call tree round you were paired for and the feedback you shared." },
      { property: "og:title", content: "My Call Tree History — Kinfolk" },
      { property: "og:description", content: "See every call tree round you were paired for and the feedback you shared." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type FeedbackStatus = "doing_great" | "not_sure" | "needs_help";

const STATUS_META: Record<FeedbackStatus, { label: string; Icon: typeof CheckCircle2; tone: string }> = {
  doing_great: { label: "Doing Great", Icon: CheckCircle2, tone: "bg-success/10 text-success" },
  not_sure: { label: "Not Sure", Icon: HelpCircle, tone: "bg-warning/15 text-warning-foreground" },
  needs_help: { label: "Needs Help", Icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
};

function MemberCallTree() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getMyCallTreeHistory>> | null>(null);

  useEffect(() => {
    getMyCallTreeHistory().then(setRows);
  }, []);

  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Call tree</p>
        <h1 className="font-display text-3xl font-bold">My call tree history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every round you were paired for, who you were paired with, and the feedback you shared.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <PhoneCall className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No call tree rounds yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Once your admin starts a round, your pairing will appear here.
          </p>
          <Link to="/member" className="mt-4 inline-block text-xs font-semibold text-accent">
            Back to home →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const meta = r.feedback ? STATUS_META[r.feedback.status as FeedbackStatus] : null;
            return (
              <li key={r.pairingId} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {r.sessionStatus === "active" ? "Active round" : r.sessionStatus === "closed" ? "Closed round" : "Draft round"}
                    </p>
                    <h2 className="mt-0.5 font-display text-lg font-bold">{r.sessionName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Paired with {r.partners.join(", ") || "—"}
                    </p>
                  </div>
                  {meta ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}>
                      <meta.Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                  ) : r.token && r.sessionStatus === "active" ? (
                    <Link
                      to="/feedback/$token"
                      params={{ token: r.token }}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Submit feedback
                    </Link>
                  ) : (
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      No feedback
                    </span>
                  )}
                </div>
                {r.feedback?.notes && (
                  <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">"{r.feedback.notes}"</p>
                )}
                {r.feedback?.submittedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Shared on {new Date(r.feedback.submittedAt).toLocaleDateString()}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
