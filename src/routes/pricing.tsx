import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { listSubscriptionTiers, getTrialSettings } from "@/lib/payments/tiers.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Kommunity" },
      { name: "description", content: "Simple plans for communities of every size, billed in USD or NGN." },
    ],
  }),
  component: Pricing,
});

type Tier = Awaited<ReturnType<typeof listSubscriptionTiers>>[number];
type Trial = Awaited<ReturnType<typeof getTrialSettings>>;

// Friendlier labels for the module keys the super admin toggles per plan.
// Anything not listed falls back to the raw module name, so a new module
// added in the admin console still shows up here without a code change.
const MODULE_LABELS: Record<string, string> = {
  Membership: "Membership management",
  Birthdays: "Birthday messages",
  Broadcasts: "Information broadcasts",
  "Call Tree": "Call tree wellbeing check-ins",
  Dues: "Dues collection + reminders",
  Donations: "Donations & fundraising",
  Elections: "Digital elections",
};

function planFeatures(tier: Tier): string[] {
  const modules = tier.modules.map((m) => MODULE_LABELS[m] ?? m);
  const cap = tier.maxMembers != null ? `Up to ${tier.maxMembers.toLocaleString()} members` : "Unlimited members";
  return [cap, ...modules];
}

function Pricing() {
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [trial, setTrial] = useState<Trial | null>(null);

  useEffect(() => {
    listSubscriptionTiers()
      .then((all) => setTiers(all.filter((t) => t.active)))
      .catch(() => setTiers([]));
    getTrialSettings().then(setTrial).catch(() => {});
  }, []);

  // Highlight the second plan (a common "most popular" middle tier) when
  // there's more than one.
  const highlightIndex = tiers && tiers.length >= 2 ? 1 : -1;

  const trialNote =
    trial && trial.enabled
      ? `Every plan starts with a ${trial.days}-day${trial.tierName ? ` ${trial.tierName}` : ""} trial. Cancel anytime.`
      : "Pick a plan to get started.";

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Pricing</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">Plans that scale with your community.</h1>
          <p className="mt-4 text-muted-foreground">{trialNote}</p>

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

        {tiers === null ? (
          <div className="mt-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="mx-auto mt-14 max-w-md rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-lg font-semibold">Plans are being set up</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back shortly, or start a free trial and pick a plan from inside your dashboard.
            </p>
            <Link
              to="/signup"
              className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        ) : (
          <div className={`mt-14 grid gap-6 ${tiers.length >= 3 ? "md:grid-cols-3" : tiers.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1 md:max-w-md md:mx-auto"}`}>
            {tiers.map((t, i) => {
              const highlight = i === highlightIndex;
              const price = currency === "USD" ? t.monthly_price_usd : t.monthly_price_ngn;
              const priced = price > 0;
              // Truly free (0 in both) vs. simply not priced in the selected
              // currency (priced in the other one) — shown differently below.
              const freePlan = t.monthly_price_usd === 0 && t.monthly_price_ngn === 0;
              return (
                <div
                  key={t.id}
                  className={`relative rounded-3xl border p-8 shadow-soft transition ${
                    highlight ? "border-primary bg-gradient-hero text-primary-foreground shadow-elegant" : "border-border bg-card"
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                      Most popular
                    </span>
                  )}
                  <p className={`text-xs font-semibold uppercase tracking-wider ${highlight ? "text-primary-foreground/70" : "text-accent"}`}>{t.name}</p>
                  <p className="mt-4 font-display text-5xl font-bold">
                    {priced ? (
                      <>
                        {currency === "USD" ? `$${price.toLocaleString()}` : `₦${price.toLocaleString()}`}
                        <span className={`text-base font-medium ${highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>/mo</span>
                      </>
                    ) : (
                      <span className="text-3xl">{freePlan ? "Free" : "—"}</span>
                    )}
                  </p>
                  {!priced && !freePlan && (
                    <p className={`mt-1 text-xs ${highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      Available in {currency === "USD" ? "Naira" : "Dollars"} — switch currency above
                    </p>
                  )}
                  <ul className="mt-6 space-y-3 text-sm">
                    {planFeatures(t).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${highlight ? "text-accent" : "text-success"}`} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/signup"
                    className={`mt-8 flex justify-center rounded-full py-2.5 text-sm font-semibold transition ${
                      highlight ? "bg-accent text-accent-foreground hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}
                  >
                    Start with {t.name}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <MarketingFooter />
    </div>
  );
}
