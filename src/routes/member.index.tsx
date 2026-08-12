import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/membership/members.functions";
import { getMyBallot } from "@/lib/membership/elections.functions";
import { getMyDuesInfo } from "@/lib/payments/dues.functions";
import { listMyBroadcasts } from "@/lib/membership/broadcasts.functions";
import { listMyExecutives } from "@/lib/membership/members.functions";
import { getMyCallTreeHistory } from "@/lib/membership/calltree.functions";
import { formatYm, parseYm } from "@/lib/dues-period";
import { PhoneCall, Banknote, Megaphone, ArrowUpRight, Check } from "lucide-react";

export const Route = createFileRoute("/member/")({
  component: MemberHome,
});

type Me = Awaited<ReturnType<typeof getMyProfile>>;
type Ballot = Awaited<ReturnType<typeof getMyBallot>>;
type DuesInfo = Awaited<ReturnType<typeof getMyDuesInfo>>;
type Broadcasts = Awaited<ReturnType<typeof listMyBroadcasts>>;
type Executives = Awaited<ReturnType<typeof listMyExecutives>>;
type CallTreeHistory = Awaited<ReturnType<typeof getMyCallTreeHistory>>;

// Bare "YYYY-MM-DD" string check — no `new Date(...)` round trip, same
// reasoning as admin.birthdays.tsx's dobParts: parsing a bare date and
// re-reading it with local accessors can silently shift the day depending
// on the viewer's timezone.
function isBirthdayToday(dob: string): boolean {
  if (!dob) return false;
  const [, month, day] = dob.split("-").map(Number);
  if (!month || !day) return false;
  const now = new Date();
  return month === now.getMonth() + 1 && day === now.getDate();
}

function MemberHome() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [dues, setDues] = useState<DuesInfo>({ plan: null, coverage: { nextDue: null }, history: [] });
  const [broadcasts, setBroadcasts] = useState<Broadcasts>([]);
  const [executives, setExecutives] = useState<Executives>([]);
  const [callTree, setCallTree] = useState<CallTreeHistory>([]);

  useEffect(() => {
    getMyProfile().then(setMe).catch(() => setMe(null));
    getMyBallot().then(setBallot).catch(() => {});
    getMyDuesInfo().then(setDues).catch(() => {});
    listMyBroadcasts().then(setBroadcasts).catch(() => {});
    listMyExecutives().then(setExecutives).catch(() => {});
    getMyCallTreeHistory().then(setCallTree).catch(() => {});
  }, []);

  if (me === undefined) {
    return <div className="min-h-[40vh]" />;
  }

  if (!me) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold">Welcome 👋</h1>
          <p className="text-sm text-muted-foreground">No member data yet.</p>
        </header>
      </div>
    );
  }

  const isBirthday = isBirthdayToday(me.dob);
  const activePairing = callTree.find((r) => r.sessionStatus === "active" && !r.feedback);
  const feedbackToken = activePairing?.token ?? null;
  const hasVoted = !!ballot?.positions.some((p) => p.myVote);

  const amountLabel = dues.plan
    ? [dues.plan.amountNgn ? `₦${dues.plan.amountNgn.toLocaleString()}` : null, dues.plan.amountUsd ? `$${dues.plan.amountUsd.toLocaleString()}` : null]
        .filter(Boolean)
        .join(" / ")
    : null;

  return (
    <div className="space-y-6">
      {isBirthday && (
        <div className="rounded-3xl border border-accent/30 bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
          <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/70">🎂 Happy birthday, {me.name.split(" ")[0]}!</p>
          <h2 className="mt-2 font-display text-3xl font-bold">May this year overflow with peace and laughter.</h2>
          <p className="mt-2 text-primary-foreground/80">From everyone in your community — we celebrate you today.</p>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{me.communityName || "Welcome"}</p>
          <h1 className="font-display text-3xl font-bold">Hi, {me.name.split(" ")[0]} 👋</h1>
        </div>
        <Link to="/member/profile" className="text-xs font-semibold text-accent">View profile →</Link>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Election */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {ballot?.election ? `Live election · ${ballot.election.year}` : "Elections"}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold">
                {!ballot?.election ? "No election running" : hasVoted ? "Your choices" : "Cast your vote"}
              </h2>
            </div>
            {ballot?.election && (
              <Link to="/member/elections" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                {hasVoted ? "View" : "Cast vote"} <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {ballot?.election ? (
            ballot.positions.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No positions are open for this cycle yet.</p>
            ) : (
              <>
                <ul className="mt-5 space-y-3">
                  {ballot.positions.slice(0, hasVoted ? 4 : 2).map((p) => {
                    const chosen = p.myVote ? p.candidates.find((c) => c.id === p.myVote) : null;
                    return (
                      <li key={p.id} className="rounded-xl border border-border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{p.role}</span>
                          {chosen ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                              <Check className="h-3 w-3" /> {chosen.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {p.candidates.length} candidates{hasVoted ? " · not voted" : ""}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {hasVoted && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    You've already voted in this cycle. Your choices are locked in.
                  </p>
                )}
              </>
            )
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Check back once your admin starts a new election cycle.</p>
          )}
        </div>

        {/* Call tree */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <PhoneCall className="h-3.5 w-3.5" /> Call tree assignment
          </div>
          {feedbackToken ? (
            <>
              <p className="mt-2 text-sm">You have an active pairing</p>
              <Link
                to="/feedback/$token"
                params={{ token: feedbackToken }}
                className="mt-4 block w-full rounded-full bg-primary py-2 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Submit feedback
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No active call tree assignment.</p>
          )}
        </div>

        {/* Dues */}
        <div className="col-span-12 rounded-2xl border border-border bg-gradient-accent p-6 text-primary-foreground shadow-elegant md:col-span-5">
          <Banknote className="h-5 w-5 opacity-80" />
          <p className="mt-3 text-xs uppercase tracking-wider opacity-70">
            {dues.plan ? "Dues amount" : "Dues"}
          </p>
          <p className="mt-1 font-display text-3xl font-bold">{amountLabel ?? "Not set up yet"}</p>
          <p className="mt-1 text-xs opacity-80">
            {dues.plan ? `${dues.plan.interval.charAt(0).toUpperCase()}${dues.plan.interval.slice(1)}` : "Ask your admin to set up dues"}
          </p>
          {dues.coverage.nextDue && (
            <p className="mt-2 text-xs opacity-80">Next due from {formatYm(parseYm(dues.coverage.nextDue))}</p>
          )}
          <Link to="/member/dues" className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold">Pay now <ArrowUpRight className="h-3 w-3" /></Link>
        </div>

        {/* Updates */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-7">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Latest updates</p>
            <Link to="/member/updates" className="text-xs font-semibold text-accent">View all →</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {broadcasts.slice(0, 4).map((b) => (
              <li key={b.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <Megaphone className="mt-0.5 h-4 w-4 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">Sent {b.date}</p>
                </div>
              </li>
            ))}
            {broadcasts.length === 0 && (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            )}
          </ul>
        </div>

        {/* Executive */}
        <div className="col-span-12 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current executive members</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {executives.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-sm font-bold text-primary-foreground">
                    {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {m.email && <p>{m.email}</p>}
                  {m.phone && <p>{m.phone}</p>}
                </div>
              </div>
            ))}
            {executives.length === 0 && (
              <p className="text-sm text-muted-foreground">No executive roles assigned yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
