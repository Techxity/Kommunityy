import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { dues, duesHistory } from "@/lib/mock-data";
import { AlertTriangle, Banknote, Loader2 } from "lucide-react";

export const Route = createFileRoute("/member/dues")({
  component: MemberDues,
});

function MemberDues() {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const myHistory = duesHistory.filter((d) => d.member === "Adaeze Okafor" || true).slice(0, 5);
  const missed = myHistory.filter((d) => d.status === "Missed").length;

  const payNow = async () => {
    setPayErr(null);
    setPaying(true);
    try {
      const { data, error } = await supabase
        .from("dues_plans")
        .select("id")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No active dues plan yet — ask your admin to set one up.");
      navigate({ to: "/pay-dues/$planId", params: { planId: data.id } });
    } catch (e: any) {
      setPayErr(e.message ?? "Could not start payment");
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">My dues</h1>
        <p className="text-sm text-muted-foreground">Pay your community contributions and track your history.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-gradient-accent p-6 text-primary-foreground shadow-elegant md:col-span-2">
          <Banknote className="h-5 w-5 opacity-80" />
          <p className="mt-3 text-xs uppercase tracking-wider opacity-70">Next payment due</p>
          <p className="mt-1 font-display text-4xl font-bold">₦{dues.amount.toLocaleString()}</p>
          <p className="mt-1 text-xs opacity-80">{dues.frequency} · due {dues.nextDue}</p>
          <button
            onClick={payNow}
            disabled={paying}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-semibold transition hover:bg-primary-foreground/25 disabled:opacity-60"
          >
            {paying && <Loader2 className="h-4 w-4 animate-spin" />}
            {paying ? "Starting…" : "Pay now via Paystack"}
          </button>
          {payErr && <p className="mt-2 text-xs font-medium text-primary-foreground/90">{payErr}</p>}
        </div>

        {missed > 0 ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="mt-3 text-xs uppercase tracking-wider text-destructive">Missed payments</p>
            <p className="mt-1 font-display text-3xl font-bold text-destructive">{missed}</p>
            <p className="mt-1 text-xs text-muted-foreground">Please clear missed payments to remain active.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-success/30 bg-success/5 p-6">
            <p className="text-xs uppercase tracking-wider text-success">All caught up</p>
            <p className="mt-1 font-display text-2xl font-bold">No missed payments</p>
            <p className="mt-1 text-xs text-muted-foreground">Thank you for staying current.</p>
          </div>
        )}
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
            {myHistory.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-3">{d.date}</td>
                <td className="px-4 py-3">₦{d.amount.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.status === "Paid" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{d.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
