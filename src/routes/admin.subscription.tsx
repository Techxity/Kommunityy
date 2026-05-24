import { createFileRoute } from "@tanstack/react-router";
import { community } from "@/lib/mock-data";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/subscription")({
  component: Subscription,
});

const plans = [
  { name: "Basic", usd: 19, ngn: 14500, features: ["Membership management", "Birthday messages", "Broadcasts", "Call tree"] },
  { name: "Premium", usd: 49, ngn: 39000, features: ["Everything in Basic", "Dues", "Donations", "Payment history"] },
  { name: "Enterprise", usd: 99, ngn: 78000, features: ["Everything in Premium", "Elections", "Election analytics", "Priority support"] },
];

function Subscription() {
  const [currency, setCurrency] = useState<"USD" | "NGN">("NGN");
  const current = community.plan;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Subscription</h1>
        <p className="text-sm text-muted-foreground">You're on a {community.trialDaysLeft}-day Enterprise trial. Pick a plan to keep your full feature set.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-warning-foreground">
        <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" /> Trial ends in {community.trialDaysLeft} days — choose a plan to avoid interruption.</p>
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs">
          {(["USD", "NGN"] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)} className={`rounded-full px-3 py-1 font-semibold ${currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {c === "USD" ? "$ USD" : "₦ NGN"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.name === current;
          return (
            <div key={p.name} className={`relative rounded-2xl border p-6 shadow-soft ${isCurrent ? "border-primary bg-gradient-hero text-primary-foreground shadow-elegant" : "border-border bg-card"}`}>
              {isCurrent && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Current</span>
              )}
              <p className={`text-xs font-semibold uppercase tracking-wider ${isCurrent ? "text-primary-foreground/70" : "text-accent"}`}>{p.name}</p>
              <p className="mt-3 font-display text-4xl font-bold">
                {currency === "USD" ? `$${p.usd}` : `₦${p.ngn.toLocaleString()}`}
                <span className={`text-sm font-medium ${isCurrent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>/mo</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isCurrent ? "text-accent" : "text-success"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold ${
                isCurrent ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary text-primary-foreground"
              }`}>
                <CreditCard className="h-3.5 w-3.5" />
                {isCurrent ? "Manage subscription" : `Subscribe — ${currency === "USD" ? `$${p.usd}` : `₦${p.ngn.toLocaleString()}`}/mo`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Subscriptions are charged via Stripe. You can update card details or download invoices here once you subscribe.</p>
      </div>
    </div>
  );
}
