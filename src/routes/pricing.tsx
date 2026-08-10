import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Kommunity" },
      { name: "description", content: "Simple plans for communities of every size. Basic, Premium, Enterprise — billed in USD or NGN." },
    ],
  }),
  component: Pricing,
});

const plans = [
  {
    name: "Basic",
    usd: 19,
    ngn: 14500,
    tagline: "Get your community organized.",
    features: ["Membership data management", "Birthday messages", "Information broadcast", "Call tree management"],
  },
  {
    name: "Premium",
    usd: 49,
    ngn: 39000,
    tagline: "Add money management.",
    highlight: true,
    features: ["Everything in Basic", "Dues collection + reminders", "Donations & fundraising", "Payment history & reports"],
  },
  {
    name: "Enterprise",
    usd: 99,
    ngn: 78000,
    tagline: "For mature communities.",
    features: ["Everything in Premium", "Digital elections", "Election analytics", "Priority support"],
  },
];

function Pricing() {
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Pricing</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">Plans that scale with your community.</h1>
          <p className="mt-4 text-muted-foreground">Every plan starts with a 14-day Enterprise trial. Cancel anytime.</p>

          <div className="mx-auto mt-8 inline-flex rounded-full border border-border bg-card p-1 text-sm">
            {(["USD", "NGN"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`rounded-full px-5 py-1.5 font-semibold transition ${
                  currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {c === "USD" ? "$ Dollars" : "₦ Naira"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl border p-8 shadow-soft transition ${
                p.highlight
                  ? "border-primary bg-gradient-hero text-primary-foreground shadow-elegant"
                  : "border-border bg-card"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                  Most popular
                </span>
              )}
              <p className={`text-xs font-semibold uppercase tracking-wider ${p.highlight ? "text-primary-foreground/70" : "text-accent"}`}>{p.name}</p>
              <p className="mt-4 font-display text-5xl font-bold">
                {currency === "USD" ? `$${p.usd}` : `₦${p.ngn.toLocaleString()}`}
                <span className={`text-base font-medium ${p.highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>/mo</span>
              </p>
              <p className={`mt-2 text-sm ${p.highlight ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{p.tagline}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-accent" : "text-success"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={`mt-8 flex justify-center rounded-full py-2.5 text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-accent text-accent-foreground hover:opacity-90"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                Start with {p.name}
              </Link>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
