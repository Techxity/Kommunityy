import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Users, DollarSign, TrendingUp, AlertTriangle, ArrowUpRight, Activity, Sparkles } from "lucide-react";
import { platformStats, communities, revenueByMonth, auditLog, supportTickets, plans } from "@/lib/platform-data";

export const Route = createFileRoute("/super-admin/")({
  head: () => ({ meta: [{ title: "Overview — Super Admin" }] }),
  component: Overview,
});

function Overview() {
  const max = Math.max(...revenueByMonth.map((r) => r.usd));
  const openTickets = supportTickets.filter((t) => t.status !== "Resolved").length;
  const pastDue = communities.filter((c) => c.status === "Past Due" || c.status === "Suspended").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Platform overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every community, every dollar, all in one place.</p>
        </div>
        <Link to="/super-admin/communities" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Manage communities <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon={Building2} label="Communities" value={platformStats.totalCommunities} sub={`${platformStats.activeCommunities} active · ${platformStats.trialCommunities} trial`} />
        <StatCard icon={Users} label="Total members" value={platformStats.totalMembers.toLocaleString()} sub={`+${platformStats.newCommunities30d} communities in 30d`} />
        <StatCard icon={DollarSign} label="MRR" value={`$${platformStats.mrrUSD.toLocaleString()}`} sub={`ARR $${platformStats.arrUSD.toLocaleString()}`} accent />
        <StatCard icon={TrendingUp} label="Churn" value={`${platformStats.churnRate}%`} sub="Trailing 30 days" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Revenue</p>
              <p className="font-display text-xl font-bold">Last 6 months</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">+33% YoY</span>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3">
            {revenueByMonth.map((r) => (
              <div key={r.month} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-primary to-accent"
                  style={{ height: `${(r.usd / max) * 100}%` }}
                />
                <span className="text-[11px] text-muted-foreground">{r.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Plan mix</p>
          <p className="font-display text-xl font-bold">Subscriptions</p>
          <div className="mt-6 space-y-4">
            {plans.map((p) => {
              const total = plans.reduce((s, x) => s + x.activeSubscriptions, 0);
              const pct = Math.round((p.activeSubscriptions / total) * 100);
              return (
                <div key={p.tier}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.tier}</span>
                    <span className="text-muted-foreground">{p.activeSubscriptions} · {pct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Needs attention</p>
              <p className="font-display text-xl font-bold">{pastDue + openTickets} items</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between"><span>Past due accounts</span><span className="font-semibold">{pastDue}</span></li>
            <li className="flex justify-between"><span>Open support tickets</span><span className="font-semibold">{openTickets}</span></li>
            <li className="flex justify-between"><span>Trials ending in 7 days</span><span className="font-semibold">6</span></li>
            <li className="flex justify-between"><span>Failed payments (24h)</span><span className="font-semibold">2</span></li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent activity</p>
              <p className="font-display text-xl font-bold">Audit feed</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <ul className="space-y-3">
            {auditLog.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 text-accent" />
                <div className="flex-1">
                  <p><span className="font-semibold">{a.actor}</span> {a.action.toLowerCase()} <span className="font-semibold">{a.target}</span></p>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: typeof Building2; label: string; value: string | number; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-5 shadow-soft ${accent ? "bg-gradient-to-br from-primary to-accent text-primary-foreground" : "bg-card"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs uppercase tracking-wider ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
        <Icon className={`h-4 w-4 ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`} />
      </div>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
      <p className={`mt-1 text-xs ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{sub}</p>
    </div>
  );
}
