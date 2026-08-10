import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  listPayoutRequests,
  approvePayoutPaystack,
  markPayoutPaid,
  rejectPayout,
} from "@/lib/payments/payouts.functions";
import { migrateCommunitiesToSubaccounts } from "@/lib/payments/bank.functions";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";

export const Route = createFileRoute("/super-admin/payouts")({
  component: SuperPayoutsPage,
});

type Row = {
  id: string;
  amount: number;
  currency: "NGN" | "USD";
  source: "dues" | "donations";
  status: string;
  method: string | null;
  requested_at: string;
  paid_at: string | null;
  notes: string | null;
  failed_reason: string | null;
  community_id: string;
  community: { name: string; bank_name: string | null; account_number: string | null; account_name: string | null; paystack_recipient_code: string | null } | null;
};

const sym = (c: "NGN" | "USD") => (c === "NGN" ? "₦" : "$");

function SuperPayoutsPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const listFn = useServerFn(listPayoutRequests);
  const approveFn = useServerFn(approvePayoutPaystack);
  const markFn = useServerFn(markPayoutPaid);
  const rejectFn = useServerFn(rejectPayout);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listFn({ data: { pending_only: tab === "pending" } });
        setRows((data ?? []) as any);
      } catch (e: any) {
        setErr(e.message ?? "Could not load payouts");
        setRows([]);
      }
      setLoading(false);
    })();
  }, [tab, tick]);

  const wrap = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setErr(null);
    try {
      await fn();
      setTick((t) => t + 1);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Payouts</h1>
        <p className="text-sm text-muted-foreground">Approve community withdrawal requests.</p>
      </header>

      <SubaccountMigrationPanel />

      <div className="flex gap-2">
        <Chip active={tab === "pending"} onClick={() => setTab("pending")}>
          Pending
        </Chip>
        <Chip active={tab === "all"} onClick={() => setTab("all")}>
          All
        </Chip>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No payouts.</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <Wallet className="h-4 w-4 text-primary" />
                    <p className="font-display text-base font-bold">
                      {sym(r.currency)}
                      {Number(r.amount).toLocaleString()} → {r.community?.name}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {r.source}
                    </span>
                    {statusBadge(r.status)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.community?.bank_name
                      ? `${r.community.bank_name} • ${r.community.account_number} • ${r.community.account_name}`
                      : "No bank details on file"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Requested {new Date(r.requested_at).toLocaleString()}
                    {r.paid_at && ` • Paid ${new Date(r.paid_at).toLocaleString()}`}
                  </p>
                  {r.failed_reason && (
                    <p className="text-xs text-destructive">{r.failed_reason}</p>
                  )}
                </div>
                {r.status === "requested" && (
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {r.currency === "NGN" && r.community?.paystack_recipient_code && (
                      <Button
                        size="sm"
                        onClick={() =>
                          wrap(r.id, () => approveFn({ data: { payout_id: r.id } }))
                        }
                        disabled={busy === r.id}
                      >
                        {busy === r.id ? "…" : "Approve via Paystack"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        wrap(r.id, () => markFn({ data: { payout_id: r.id } }))
                      }
                      disabled={busy === r.id}
                    >
                      Mark as manually paid
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const reason = prompt("Reason for rejecting?");
                        if (!reason) return;
                        wrap(r.id, () => rejectFn({ data: { payout_id: r.id, reason } }));
                      }}
                      disabled={busy === r.id}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {r.status === "approved" && (
                  <div className="flex gap-2 md:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => wrap(r.id, () => markFn({ data: { payout_id: r.id } }))}
                    >
                      Mark as paid manually
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One-time (but safe-to-re-run) migration: creates a Paystack subaccount for
// every community that already has verified bank details from the old
// manual-payout flow but hasn't been given a subaccount yet. After this
// runs, their NEW NGN dues/donations split at Paystack automatically —
// whatever was already collected before migration stays payable through the
// normal payout flow above.
function SubaccountMigrationPanel() {
  const migrateFn = useServerFn(migrateCommunitiesToSubaccounts);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof migrateCommunitiesToSubaccounts>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await migrateFn();
      setResult(r);
    } catch (e: any) {
      setErr(e.message ?? "Migration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="font-display text-base font-bold">Paystack subaccounts</p>
            <p className="text-xs text-muted-foreground">
              Back-fill a subaccount for communities that already have verified bank details on file.
              New NGN dues/donations for them will settle automatically — no payout request needed.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={run} disabled={busy}>
          {busy ? "Migrating…" : "Migrate eligible communities"}
        </Button>
      </div>
      {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
      {result && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>
            {result.migrated.length} migrated · {result.failed.length} failed · {result.totalCandidates} candidates checked.
          </p>
          {result.migrated.length > 0 && (
            <p>Migrated: {result.migrated.map((m) => m.name).join(", ")}</p>
          )}
          {result.failed.length > 0 && (
            <p className="text-destructive">
              Failed: {result.failed.map((f) => `${f.name} (${f.error})`).join("; ")}
            </p>
          )}
          {result.totalCandidates === 0 && <p>No communities are waiting on migration.</p>}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function statusBadge(s: string) {
  const map: Record<string, { c: string; Icon: typeof Clock }> = {
    requested: { c: "bg-yellow-100 text-yellow-900", Icon: Clock },
    approved: { c: "bg-blue-100 text-blue-900", Icon: Clock },
    paid: { c: "bg-green-100 text-green-900", Icon: CheckCircle2 },
    failed: { c: "bg-red-100 text-red-900", Icon: XCircle },
    rejected: { c: "bg-red-100 text-red-900", Icon: XCircle },
  };
  const { c, Icon } = map[s] ?? map.requested;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>
      <Icon className="h-3 w-3" /> {s}
    </span>
  );
}
