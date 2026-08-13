import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSmsReserveStatus } from "@/lib/sms/sms.functions";
import { MessageSquare, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/super-admin/sms")({
  component: SmsReserve,
});

type Status = Awaited<ReturnType<typeof getSmsReserveStatus>>;

function naira(kobo: number | null): string {
  if (kobo == null) return "—";
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function SmsReserve() {
  const [s, setS] = useState<Status | null | undefined>(undefined);

  useEffect(() => {
    getSmsReserveStatus().then(setS).catch(() => setS(null));
  }, []);

  if (s === undefined) return <div className="min-h-[40vh]" />;
  if (!s) return <p className="text-sm text-muted-foreground">Couldn't load SMS reserve status.</p>;

  const covered = s.covered;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-accent text-primary-foreground">
          <MessageSquare className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">SMS reserve</h1>
          <p className="text-sm text-muted-foreground">
            Communities' prepaid balances are a liability the shared Termii account must always cover. Keep the reserve above total liabilities.
          </p>
        </div>
      </header>

      {covered === false && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Reserve is below total liabilities.</p>
            <p className="text-muted-foreground">Top up the Termii account now — communities hold more SMS credit than the account can currently deliver.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Termii reserve" value={naira(s.reserveKobo)} sub={s.reserveKobo == null ? "Termii not configured" : "live account balance"} tone="default" />
        <Stat label="Total liabilities" value={naira(s.liabilitiesKobo)} sub={`${s.fundedCommunities} funded communities`} tone="default" />
        <Stat
          label="Headroom"
          value={naira(s.headroomKobo)}
          sub={covered == null ? "needs Termii balance" : covered ? "reserve covers liabilities" : "shortfall — top up"}
          tone={covered === false ? "bad" : covered ? "good" : "default"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-sm font-semibold">Community balances</h2>
          <p className="text-xs text-muted-foreground">Where the liability sits (funded communities, largest first).</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {s.communities.map((c, i) => (
                <tr key={i} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{naira(c.balanceKobo)}</td>
                </tr>
              ))}
              {s.communities.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-sm text-muted-foreground">No community has a funded SMS wallet yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "default" | "good" | "bad" }) {
  const border = tone === "bad" ? "border-destructive/40 bg-destructive/5" : tone === "good" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card";
  const Icon = tone === "bad" ? AlertTriangle : tone === "good" ? CheckCircle2 : TrendingUp;
  const iconColor = tone === "bad" ? "text-destructive" : tone === "good" ? "text-emerald-600" : "text-accent";
  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${border}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
