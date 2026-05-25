import { createFileRoute } from "@tanstack/react-router";
import { Download, ArrowUpRight } from "lucide-react";
import { revenueByMonth, communities, platformStats } from "@/lib/platform-data";

export const Route = createFileRoute("/super-admin/billing")({
  head: () => ({ meta: [{ title: "Billing — Super Admin" }] }),
  component: Billing,
});

function Billing() {
  const invoices = [
    { id: "INV-3041", community: "Crestwood Estate Residents", amount: 299, date: "May 12, 2025", status: "Paid" },
    { id: "INV-3040", community: "Akoma Mutual Society", amount: 299, date: "May 11, 2025", status: "Paid" },
    { id: "INV-3039", community: "Lagos Alumni Network '08", amount: 99, date: "May 10, 2025", status: "Paid" },
    { id: "INV-3038", community: "Silver Heights HOA", amount: 29, date: "May 09, 2025", status: "Failed" },
    { id: "INV-3037", community: "Oakridge Tenants Union", amount: 99, date: "May 08, 2025", status: "Paid" },
    { id: "INV-3036", community: "Delta Tech Cooperative", amount: 99, date: "May 06, 2025", status: "Paid" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Billing & revenue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Subscription revenue from {communities.length}+ communities.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="MRR" value={`$${platformStats.mrrUSD.toLocaleString()}`} delta="+6.4%" />
        <Stat label="ARR" value={`$${platformStats.arrUSD.toLocaleString()}`} delta="+18%" />
        <Stat label="Avg. Revenue / Community" value="$209" delta="+2.1%" />
        <Stat label="Net Revenue Retention" value="112%" delta="+4pt" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Revenue</p>
        <p className="font-display text-xl font-bold">Trailing 6 months</p>
        <div className="mt-6 flex h-56 items-end gap-3">
          {revenueByMonth.map((r) => {
            const max = Math.max(...revenueByMonth.map((x) => x.usd));
            return (
              <div key={r.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold tabular-nums">${(r.usd / 1000).toFixed(1)}k</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-primary to-accent" style={{ height: `${(r.usd / max) * 100}%` }} />
                <span className="text-[11px] text-muted-foreground">{r.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="font-display text-lg font-semibold">Recent invoices</p>
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            View all <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Invoice</th>
              <th className="px-5 py-3 text-left">Community</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-xs">{i.id}</td>
                <td className="px-5 py-3 font-medium">{i.community}</td>
                <td className="px-5 py-3 text-muted-foreground">{i.date}</td>
                <td className="px-5 py-3 text-right tabular-nums">${i.amount}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.status === "Paid" ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>{i.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold text-emerald-600">{delta} vs last month</p>
    </div>
  );
}
