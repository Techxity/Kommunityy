import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyCommunity, getDashboardStats } from "@/lib/payments/communities.functions";
import { listMyDonations } from "@/lib/payments/donations.functions";
import { listDuesPayments } from "@/lib/payments/dues.functions";
import { getElectionsAdminData } from "@/lib/membership/elections.functions";
import {
  Users,
  Cake,
  Megaphone,
  Banknote,
  Vote,
  HeartHandshake,
  ArrowUpRight,
  Sparkles,
  Trophy,
} from "lucide-react";

type BirthdayStat = { id: string; name: string; dob: string; sentThisYear: boolean };
type ElectionData = Awaited<ReturnType<typeof getElectionsAdminData>>["election"];

// Given a member's birthday (bare "YYYY-MM-DD") and whether their message has
// gone out this year, decide how it should appear on the dashboard:
//  - keep it in the list only until 2 days after the birthday, then clear it;
//  - label it "Sent" once the message has gone out, "Scheduled" while it's
//    still upcoming, and "Missed" if the day passed without a send.
// All date math is in UTC to match the app's timezone-safe date handling.
function birthdayView(dob: string, sentThisYear: boolean): { show: boolean; label: "Sent" | "Scheduled" | "Missed"; tone: string } {
  const [, month, day] = dob.split("-").map(Number);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const bday = Date.UTC(now.getUTCFullYear(), (month || 1) - 1, day || 1);
  const daysSince = Math.round((today - bday) / 86_400_000);
  const show = daysSince <= 2; // future, today, or up to 2 days after
  if (sentThisYear) return { show, label: "Sent", tone: "bg-success/15 text-success" };
  if (daysSince > 0) return { show, label: "Missed", tone: "bg-warning/20 text-warning-foreground" };
  return { show, label: "Scheduled", tone: "bg-accent/15 text-accent" };
}

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Formats a "YYYY-MM-DD" dob string directly from its parts instead of
// through `new Date(...)` — parsing a bare date and re-formatting it can
// silently shift the day by one depending on the viewer's local timezone.
function formatDob(dob: string): string {
  const [, month, day] = dob.split("-").map(Number);
  if (!month || !day) return "";
  return `${SHORT_MONTHS[month - 1]} ${day}`;
}

function Dashboard() {
  const [community, setCommunity] = useState<{ id: string; name: string; trialDaysLeft: number; onTrial: boolean; tierName: string | null } | null>(null);
  const [memberStats, setMemberStats] = useState({ activeMembers: 0, totalMembers: 0, birthdaysThisMonth: [] as BirthdayStat[], messagesSent30d: 0 });
  const [activeDonations, setActiveDonations] = useState<Awaited<ReturnType<typeof listMyDonations>>>([]);
  const [duesCollectedMtdNgn, setDuesCollectedMtdNgn] = useState(0);
  const [election, setElection] = useState<ElectionData>(null);

  useEffect(() => {
    getMyCommunity().then(setCommunity).catch(() => setCommunity(null));
    getDashboardStats().then(setMemberStats).catch(() => {});
    getElectionsAdminData().then((d) => setElection(d.election)).catch(() => {});
    listMyDonations().then((rows) => setActiveDonations(rows.filter((d) => d.status === "active"))).catch(() => {});
    listDuesPayments().then((rows) => {
      const now = new Date();
      const mtd = rows
        .filter((r) => r.status === "paid" && r.currency === "NGN" && new Date(r.paidAt).getMonth() === now.getMonth() && new Date(r.paidAt).getFullYear() === now.getFullYear())
        .reduce((sum, r) => sum + r.amount, 0);
      setDuesCollectedMtdNgn(mtd);
    }).catch(() => {});
  }, []);

  // Attach display state, drop anything already >2 days past, keep the next 5.
  const birthdayCards = memberStats.birthdaysThisMonth
    .map((m) => ({ ...m, view: birthdayView(m.dob, m.sentThisYear) }))
    .filter((m) => m.view.show)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Here's how your community is doing.</h1>
        </div>
        {community?.onTrial && (
          <div className="rounded-full border border-warning/40 bg-warning/10 px-4 py-1.5 text-xs font-semibold text-warning-foreground">
            <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3" />
            {community.trialDaysLeft} days left in your {community.tierName ?? ""} trial
          </div>
        )}
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4">
        <Tile className="col-span-12 md:col-span-3" tone="primary" label="Active members" value={memberStats.activeMembers} sub={`of ${memberStats.totalMembers} total`} icon={Users} link="/admin/members" />
        <Tile className="col-span-6 md:col-span-3" label="Birthdays this month" value={memberStats.birthdaysThisMonth.length} sub="Auto messages on" icon={Cake} link="/admin/birthdays" />
        <Tile className="col-span-6 md:col-span-3" label="Messages sent (30d)" value={memberStats.messagesSent30d} sub="Broadcasts + birthdays" icon={Megaphone} link="/admin/broadcast" />
        <Tile className="col-span-12 md:col-span-3" tone="accent" label="Dues collected MTD" value={`₦${duesCollectedMtdNgn.toLocaleString()}`} sub={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })} icon={Banknote} link="/admin/dues" />

        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Upcoming &amp; recent birthdays</p>
              <h2 className="mt-1 font-display text-xl font-bold">{birthdayCards.length} {birthdayCards.length === 1 ? "celebration" : "celebrations"}</h2>
            </div>
            <Link to="/admin/birthdays" className="text-xs font-semibold text-accent">Manage →</Link>
          </div>
          {birthdayCards.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No birthdays coming up.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {birthdayCards.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">
                    {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDob(m.dob)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.view.tone}`}>{m.view.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Donations */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Active donations</p>
            <Link to="/admin/donations" className="text-xs font-semibold text-accent">View all →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {activeDonations.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No active donation campaigns yet.
              </p>
            )}
            {activeDonations.map((d) => {
              const target = d.targetNgn || d.targetUsd;
              const collected = d.targetNgn ? d.collectedNgn : d.collectedUsd;
              const symbol = d.targetNgn ? "₦" : "$";
              const pct = target > 0 ? Math.round((collected / target) * 100) : 0;
              return (
                <div key={d.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{d.purpose}</span>
                    <span className="text-muted-foreground">{d.deadline ? `Ends ${d.deadline}` : "No end date"}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-xl font-bold">{symbol}{collected.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">/ {symbol}{target.toLocaleString()}</span>
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

        {/* Current election cycle */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Vote className="h-4 w-4 text-accent" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Current election</p>
              {election && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    election.status === "live"
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {election.status === "live" ? "Live" : "Ended"} · {election.year}
                </span>
              )}
            </div>
            <Link to="/admin/elections" className="text-xs font-semibold text-accent">Manage →</Link>
          </div>

          {!election ? (
            <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No election cycle yet. Start one from the Elections page.
            </p>
          ) : election.positions.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No positions set up for this cycle yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {election.positions.map((p) => {
                const sorted = [...p.candidates].sort((a, b) => b.votes - a.votes);
                const leader = sorted[0];
                const totalVotes = p.candidates.reduce((n, c) => n + c.votes, 0);
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold">{p.role}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {leader ? (
                          <span className="inline-flex items-center gap-1">
                            {election.status === "ended" && <Trophy className="h-3 w-3 text-accent" />}
                            {election.status === "ended" ? "Winner" : "Leading"}: {leader.name}
                          </span>
                        ) : (
                          "No candidates"
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-base font-bold">{leader ? leader.votes : 0}</p>
                      <p className="text-[10px] text-muted-foreground">of {totalVotes} vote{totalVotes === 1 ? "" : "s"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
