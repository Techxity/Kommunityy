import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getActiveDuesPlanId, getMyDuesInfo } from "@/lib/payments/dues.functions";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/member/dues")({
  component: MemberDues,
});

type DuesInfo = Awaited<ReturnType<typeof getMyDuesInfo>>;

function MemberDues() {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [info, setInfo] = useState<DuesInfo>({ plan: null, history: [] });

  useEffect(() => {
    getMyDuesInfo().then(setInfo).catch(() => {});
  }, []);

  const payNow = async () => {
    setPayErr(null);
    setPaying(true);
    try {
      const planId = await getActiveDuesPlanId();
      if (!planId) throw new Error("No active dues plan yet — ask your admin to set one up.");
      navigate({ to: "/pay-dues/$planId", params: { planId } });
    } catch (e: any) {
      setPayErr(e.message ?? "Could not start payment");
      setPaying(false);
    }
  };

  const { plan, history } = info;
  const lastPaid = history[0];
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
          <p className="mt-1 text-xs opacity-80">{plan ? `${plan.interval.charAt(0).toUpperCase()}${plan.interval.slice(1)}` : "Ask your admin to set up dues"}</p>
          <button
            onClick={payNow}
            disabled={paying || !plan}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-semibold transition hover:bg-primary-foreground/25 disabled:opacity-60"
          >
            {paying && <Loader2 className="h-4 w-4 animate-spin" />}
            {paying ? "Starting…" : "Pay now via Paystack"}
          </button>
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
            <tr><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody>
            {history.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-3">{d.date}</td>
                <td className="px-4 py-3">{d.currency === "NGN" ? "₦" : "$"}{d.amount.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.status === "paid" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{d.status}</span>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
