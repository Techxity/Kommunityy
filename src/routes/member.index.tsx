import { createFileRoute, Link } from "@tanstack/react-router";
import { members, election, callTreePairs, broadcasts, dues } from "@/lib/mock-data";
import { useEffect, useState } from "react";
import { useCallTreeSessions } from "@/lib/call-tree-store";
import { Cake, PhoneCall, Vote, Banknote, Megaphone, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/member/")({
  component: MemberHome,
});

function MemberHome() {
  const me = members[0]; // simulated logged-in member
  const isBirthday = new Date().toDateString() === new Date(new Date().getFullYear(), new Date(me.dob).getMonth(), new Date(me.dob).getDate()).toDateString();
  const myPairing = callTreePairs.find((p) => p.caller === me.name || p.callee === me.name);

  // Live call-tree assignment → feedback link for this member
  const sessions = useCallTreeSessions();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  let feedbackToken: string | null = null;
  for (const s of sessions) {
    if (s.status !== "active") continue;
    for (const p of s.pairings) {
      if (p.memberAId === me.id) feedbackToken = p.tokenA;
      else if (p.memberBId === me.id) feedbackToken = p.tokenB;
      else if (p.memberCId === me.id && p.tokenC) feedbackToken = p.tokenC;
      if (feedbackToken) break;
    }
    if (feedbackToken) break;
  }


  return (
    <div className="space-y-6">
      {isBirthday && (
        <div className="rounded-3xl border border-accent/30 bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
          <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/70">🎂 Happy birthday, {me.name.split(" ")[0]}!</p>
          <h2 className="mt-2 font-display text-3xl font-bold">May this year overflow with peace and laughter.</h2>
          <p className="mt-2 text-primary-foreground/80">From everyone at Crestwood Estate Residents — we celebrate you today.</p>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome</p>
          <h1 className="font-display text-3xl font-bold">Hi, {me.name.split(" ")[0]} 👋</h1>
        </div>
        <Link to="/member/profile" className="text-xs font-semibold text-accent">View profile →</Link>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Election */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Live election · {election.year}</p>
              <h2 className="mt-1 font-display text-xl font-bold">Executive Council — Vote now</h2>
            </div>
            <Link to="/member/elections" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              Cast vote <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="mt-5 space-y-3">
            {election.positions.slice(0, 2).map((p) => (
              <li key={p.role} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.role}</span>
                  <span className="text-xs text-muted-foreground">{p.candidates.length} candidates</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Call tree */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <PhoneCall className="h-3.5 w-3.5" /> Call tree assignment
          </div>
          {myPairing ? (
            <>
              <p className="mt-2 text-sm">You're paired to call</p>
              <p className="mt-1 font-display text-2xl font-bold">{myPairing.callee === me.name ? myPairing.caller : myPairing.callee}</p>
              {hydrated && feedbackToken ? (
                <Link
                  to="/feedback/$token"
                  params={{ token: feedbackToken }}
                  className="mt-4 block w-full rounded-full bg-primary py-2 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Submit feedback
                </Link>
              ) : (
                <p className="mt-4 rounded-full bg-muted py-2 text-center text-xs text-muted-foreground">
                  Feedback opens once your admin activates this call tree round.
                </p>
              )}

            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No active call tree assignment.</p>
          )}
        </div>

        {/* Dues */}
        <div className="col-span-12 rounded-2xl border border-border bg-gradient-accent p-6 text-primary-foreground shadow-elegant md:col-span-5">
          <Banknote className="h-5 w-5 opacity-80" />
          <p className="mt-3 text-xs uppercase tracking-wider opacity-70">Next dues payment</p>
          <p className="mt-1 font-display text-3xl font-bold">₦{dues.amount.toLocaleString()}</p>
          <p className="mt-1 text-xs opacity-80">Due {dues.nextDue}</p>
          <Link to="/member/dues" className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold">Pay now <ArrowUpRight className="h-3 w-3" /></Link>
        </div>

        {/* Updates */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Latest updates</p>
            <Link to="/member/updates" className="text-xs font-semibold text-accent">View all →</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {broadcasts.map((b) => (
              <li key={b.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <Megaphone className="mt-0.5 h-4 w-4 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">Sent {b.date}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Executive */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current executive members</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {members.filter((m) => ["President", "Secretary", "Treasurer", "PRO"].includes(m.role)).map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-sm font-bold text-primary-foreground">
                    {m.name.split(" ").map(p=>p[0]).join("").slice(0,2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>{m.email}</p>
                  <p>{m.phone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
