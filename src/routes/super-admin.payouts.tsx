import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  approvePayoutPaystack,
  markPayoutPaid,
  rejectPayout,
} from "@/lib/payments/payouts.functions";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/super-admin/payouts")({
  component: SuperPayoutsPage,
});

type Row = {
  id: string;
  amount: number;
  currency: "NGN" | "USD";
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
  const approveFn = useServerFn(approvePayoutPaystack);
  const markFn = useServerFn(markPayoutPaid);
  const rejectFn = useServerFn(rejectPayout);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("payouts")
        .select(
          "id, amount, currency, status, method, requested_at, paid_at, notes, failed_reason, community_id, community:communities!inner(name, bank_name, account_number, account_name, paystack_recipient_code)",
        )
        .order("requested_at", { ascending: false });
      if (tab === "pending") q = q.in("status", ["requested", "approved"]);
      const { data } = await q;
      setRows((data ?? []) as any);
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
