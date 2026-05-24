import { createFileRoute, Link } from "@tanstack/react-router";
import { stats, community, election, donations, members } from "@/lib/mock-data";
import {
  Users,
  Cake,
  Megaphone,
  Banknote,
  Vote,
  HeartHandshake,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const upcomingBirthdays = members.slice(0, 4);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back, Adaeze</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Here's how your community is doing.</h1>
        </div>
        <div className="rounded-full border border-warning/40 bg-warning/10 px-4 py-1.5 text-xs font-semibold text-warning-foreground">
          <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3" />
          {community.trialDaysLeft} days left in your Enterprise trial
        </div>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4">
        <Tile className="col-span-12 md:col-span-3" tone="primary" label="Active members" value={stats.activeMembers} sub={`of ${stats.totalMembers} total`} icon={Users} link="/admin/members" />
        <Tile className="col-span-6 md:col-span-3" label="Birthdays this month" value={stats.birthdaysThisMonth} sub="Auto messages on" icon={Cake} link="/admin/birthdays" />
        <Tile className="col-span-6 md:col-span-3" label="Messages sent (30d)" value={stats.messagesSentThisMonth} sub="Broadcasts + birthdays" icon={Megaphone} link="/admin/broadcast" />
        <Tile className="col-span-12 md:col-span-3" tone="accent" label="Dues collected MTD" value={`₦${(stats.duesCollectedMTD / 1000).toFixed(0)}k`} sub="May 2026" icon={Banknote} link="/admin/dues" />

        {/* Election panel */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Live election</p>
              <h2 className="mt-1 font-display text-xl font-bold">{election.year} Executive Council</h2>
            </div>
            <Link to="/admin/elections" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              Open <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {election.positions.map((p) => {
              const total = p.candidates.reduce((s, c) => s + c.votes, 0);
              const leader = [...p.candidates].sort((a, b) => b.votes - a.votes)[0];
              return (
                <div key={p.role} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.role}</span>
                    <span className="text-muted-foreground">{total} votes</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Leading: {leader.name}</span>
                    <span className="text-success">{Math.round((leader.votes / total) * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gradient-accent" style={{ width: `${(leader.votes / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Birthdays */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">This month's birthdays</p>
              <h2 className="mt-1 font-display text-xl font-bold">{upcomingBirthdays.length} celebrations</h2>
            </div>
            <Link to="/admin/birthdays" className="text-xs font-semibold text-accent">Manage →</Link>
          </div>
          <ul className="mt-5 space-y-3">
            {upcomingBirthdays.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">
                  {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(m.dob).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                </div>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Scheduled</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Donations */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Active donations</p>
            <Link to="/admin/donations" className="text-xs font-semibold text-accent">View all →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {donations.filter((d) => d.status === "Active").map((d) => {
              const pct = Math.round((d.collected / d.target) * 100);
              return (
                <div key={d.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{d.purpose}</span>
                    <span className="text-muted-foreground">Ends {d.deadline}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-xl font-bold">₦{d.collected.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">/ ₦{d.target.toLocaleString()}</span>
                    <span className="ml-auto text-xs font-semibold text-success">{pct}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gradient-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="col-span-12 rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elegant md:col-span-5">
          <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Quick actions</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <QA to="/admin/broadcast" icon={Megaphone} label="New broadcast" />
            <QA to="/admin/calltree" icon={HeartHandshake} label="Start call tree" />
            <QA to="/admin/dues" icon={Banknote} label="Setup dues" />
            <QA to="/admin/elections" icon={Vote} label="New election" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({
  className = "",
  tone = "default",
  label,
  value,
  sub,
  icon: Icon,
  link,
}: {
  className?: string;
  tone?: "default" | "primary" | "accent";
  label: string;
  value: string | number;
  sub: string;
  icon: typeof Users;
  link: string;
}) {
  const toneCls =
    tone === "primary"
      ? "bg-gradient-hero text-primary-foreground"
      : tone === "accent"
      ? "bg-gradient-accent text-primary-foreground"
      : "bg-card text-foreground border border-border";
  return (
    <Link to={link} className={`group block rounded-2xl p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant ${toneCls} ${className}`}>
      <div className="flex items-start justify-between">
        <Icon className="h-4 w-4 opacity-80" />
        <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
      </div>
      <p className="mt-6 font-display text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs opacity-75">{label}</p>
      <p className="mt-3 text-[11px] opacity-60">{sub}</p>
    </Link>
  );
}

function QA({ to, icon: Icon, label }: { to: string; icon: typeof Users; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-2.5 text-sm font-medium transition hover:bg-primary-foreground/10">
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
