import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getBillingOverview } from "@/lib/payments/billing.functions";

export const Route = createFileRoute("/super-admin/billing")({
  head: () => ({ meta: [{ title: "Billing — Super Admin" }] }),
  component: Billing,
});

type Overview = Awaited<ReturnType<typeof getBillingOverview>>;
type Period = "week" | "month" | "year";

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700",
  trial: "bg-blue-500/10 text-blue-700",
  free: "bg-slate-500/10 text-slate-700",
  unpaid: "bg-amber-500/10 text-amber-700",
  suspended: "bg-rose-500/10 text-rose-700",
};
const statusLabels: Record<string, string> = {
  paid: "Paid",
  trial: "On trial",
  free: "Free plan",
  unpaid: "Not paid",
  suspended: "Suspended",
};

const periodLabel: Record<Period, string> = { week: "This week", month: "This month", year: "This year" };

function Billing() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  useEffect(() => {
    setLoading(true);
    getBillingOverview({ data: { period } })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.communities.filter((c) => {
      const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase());
      const matchS = statusFilter === "All" || c.status === statusFilter;
      return matchQ && matchS;
    });
  }, [data, q, statusFilter]);

  const maxTrend = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.trend.map((r) => r.ngn), ...data.trend.map((r) => r.usd * 1500 /* rough scale so USD bars aren't invisible next to NGN */));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Billing & revenue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What communities have actually paid for their plan — collected from Paystack, not projected.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}ly
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label={`Collected ${periodLabel[period].toLowerCase()} (NGN)`} value={`₦${(data?.collectedThisPeriod.ngn ?? 0).toLocaleString()}`} />
        <Stat label={`Collected ${periodLabel[period].toLowerCase()} (USD)`} value={`$${(data?.collectedThisPeriod.usd ?? 0).toLocaleString()}`} />
        <Stat label="Paying communities" value={String(data?.payingCount ?? 0)} />
        <Stat label="Trial / not yet paying" value={String(data?.notPayingCount ?? 0)} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Revenue trend</p>
        <p className="font-display text-xl font-bold">
          Trailing {data?.trend.length ?? 0} {period}s
        </p>
        {!data || data.trend.every((r) => r.ngn === 0 && r.usd === 0) ? (
          <p className="mt-6 text-sm text-muted-foreground">No revenue collected in this window yet.</p>
        ) : (
          <div className="mt-6 flex h-56 items-end gap-2 overflow-x-auto">
            {data.trend.map((r) => (
              <div key={r.label} className="flex min-w-[44px] flex-1 flex-col items-center gap-1">
                <div className="flex h-44 w-full items-end justify-center gap-1">
                  <div
                    title={`₦${r.ngn.toLocaleString()}`}
                    className="w-1/2 rounded-t-md bg-gradient-to-t from-primary to-accent"
                    style={{ height: `${Math.max(2, (r.ngn / maxTrend) * 100)}%` }}
                  />
                  <div
                    title={`$${r.usd.toLocaleString()}`}
                    className="w-1/2 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400"
                    style={{ height: `${Math.max(r.usd > 0 ? 2 : 0, ((r.usd * 1500) / maxTrend) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{r.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gradient-to-t from-primary to-accent" /> NGN</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> USD</span>
          <span>All-time collected: ₦{(data?.collectedAllTime.ngn ?? 0).toLocaleString()} · ${(data?.collectedAllTime.usd ?? 0).toLocaleString()}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <p className="font-display text-lg font-semibold">Communities on a plan</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search community…"
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
            />
            <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1">
              {(["All", "paid", "trial", "unpaid", "free", "suspended"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize transition ${
                    statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "All" ? "All" : statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Community</th>
              <th className="px-5 py-3 text-left">Plan</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Last payment</th>
              <th className="px-5 py-3 text-right">Total paid</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {data && data.communities.length === 0 ? "No communities have signed up yet." : "No communities match your filters."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-semibold">{c.name}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.tierName}</span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {c.priceNgn > 0 || c.priceUsd > 0 ? `₦${c.priceNgn.toLocaleString()} / $${c.priceUsd.toLocaleString()}` : "Free"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[c.status] ?? "bg-muted"}`}>
                      {statusLabels[c.status]}
                      {c.status === "trial" && c.trialDaysLeft != null ? ` · ${c.trialDaysLeft}d left` : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {c.lastPaymentAt
                      ? `${c.lastPaymentCurrency === "NGN" ? "₦" : "$"}${c.lastPaymentAmount?.toLocaleString()} · ${new Date(c.lastPaymentAt).toLocaleDateString()}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {c.totalPaidNgn > 0 || c.totalPaidUsd > 0
                      ? `₦${c.totalPaidNgn.toLocaleString()} / $${c.totalPaidUsd.toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
