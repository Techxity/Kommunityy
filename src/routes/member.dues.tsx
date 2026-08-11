import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getActiveDuesPlanId, getMyDuesInfo } from "@/lib/payments/dues.functions";
import { formatYm, parseYm } from "@/lib/dues-period";
import { Banknote, CheckCircle2, Loader2, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/member/dues")({
  component: MemberDues,
});

type DuesInfo = Awaited<ReturnType<typeof getMyDuesInfo>>;

function MemberDues() {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [info, setInfo] = useState<DuesInfo>({ plan: null, coverage: { nextDue: null }, history: [] });

  useEffect(() => {
    getMyDuesInfo().then(setInfo).catch(() => {});
  }, []);

  const payNow = async () => {
    setPayErr(null);
    setPaying(true);
    try {
      const planId = await getActiveDuesPlanId();
      if (!planId) throw new Error("No active dues plan yet — ask your admin to set one up.");
      // Default the checkout to start from the first period they haven't paid
      // for yet (the month after they're paid through), so they can just pick
      // how many periods to pay forward.
      const from = info.coverage.nextDue ?? undefined;
      navigate({ to: "/pay-dues/$planId", params: { planId }, search: from ? { from } : {} });
    } catch (e: any) {
      setPayErr(e.message ?? "Could not start payment");
      setPaying(false);
    }
  };

  const { plan, history, coverage } = info;
  const lastPaid = history[0];
  const nextDueLabel = coverage.nextDue ? formatYm(parseYm(coverage.nextDue)) : null;
  const amountLabel = plan
    ? [plan.amountNgn ? `₦${plan.amountNgn.toLocaleString()}` : null, plan.amountUsd ? `$${plan.amountUsd.toLocaleString()}` : null]
        .filter(Boolean)
        .join(" / ")
    : "Not set up yet";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">My dues</h1>
        <p className="text-sm text-muted-foreground">Pay your community contributions and track your history.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-gradient-accent p-6 text-primary-foreground shadow-elegant md:col-span-2">
          <Banknote className="h-5 w-5 opacity-80" />
          <p className="mt-3 text-xs uppercase tracking-wider opacity-70">Dues amount</p>
          <p className="mt-1 font-display text-4xl font-bold">{amountLabel}</p>
          <p className="mt-1 text-xs opacity-80">
            {plan ? `Per ${plan.interval === "monthly" ? "month" : plan.interval === "quarterly" ? "quarter" : "year"}` : "Ask your admin to set up dues"}
          </p>
          {nextDueLabel && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
              <CalendarClock className="h-3.5 w-3.5" /> Next due from {nextDueLabel}
            </p>
          )}
          <div>
            <button
              onClick={payNow}
              disabled={paying || !plan}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-semibold transition hover:bg-primary-foreground/25 disabled:opacity-60"
            >
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              {paying ? "Starting…" : plan ? "Pay dues via Paystack" : "Pay now via Paystack"}
            </button>
            {plan && <p className="mt-1.5 text-xs opacity-80">Pay one or more {plan.interval === "monthly" ? "months" : plan.interval === "quarterly" ? "quarters" : "years"} at a time.</p>}
          </div>
          {payErr && <p className="mt-2 text-xs font-medium text-primary-foreground/90">{payErr}</p>}
        </div>

        <div className="rounded-2xl border border-success/30 bg-success/5 p-6">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="mt-3 text-xs uppercase tracking-wider text-success">Last payment</p>
          {lastPaid ? (
            <>
              <p className="mt-1 font-display text-2xl font-bold">{lastPaid.currency === "NGN" ? "₦" : "$"}{lastPaid.amount.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{lastPaid.date}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No payments yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Payment history</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Covers</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((d) => {
              const unit = plan?.interval === "quarterly" ? "quarter" : plan?.interval === "yearly" ? "year" : "month";
              const covers = d.periodStart
                ? `${d.months} ${unit}${d.months > 1 ? "s" : ""} from ${formatYm(parseYm(d.periodStart))}`
                : d.months > 1
                ? `${d.months} ${unit}s`
                : "—";
              return (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3">{d.date}</td>
                  <td className="px-4 py-3">{d.currency === "NGN" ? "₦" : "$"}{d.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{covers}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.status === "paid" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{d.status}</span>
                  </td>
                </tr>
              );
            })}
            {history.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
