import { createFileRoute } from "@tanstack/react-router";
import { getMyCommunity, subscribeToPlan } from "@/lib/payments/communities.functions";
import { listSubscriptionTiers, startPlanCheckout, verifyPlanPayment } from "@/lib/payments/tiers.functions";
import { CalendarClock, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/subscription")({
  component: Subscription,
});

type Tier = Awaited<ReturnType<typeof listSubscriptionTiers>>[number];
type Community = Awaited<ReturnType<typeof getMyCommunity>>;

function Subscription() {
  const [currency, setCurrency] = useState<"USD" | "NGN">("NGN");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [community, setCommunity] = useState<Community>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  function refresh() {
    getMyCommunity().then(setCommunity).catch(() => setCommunity(null));
    listSubscriptionTiers().then((rows) => setTiers(rows.filter((t) => t.active)));
  }

  useEffect(() => {
    refresh();

    // Paystack appends ?reference=... (and ?trxref=...) to the callback URL
    // when it redirects back here after checkout. The webhook that actually
    // grants the plan runs async and can arrive after this page has already
    // loaded, which is exactly what could leave the sidebar showing locked
    // modules even though the payment succeeded. Confirm proactively instead
    // of waiting on it.
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) return;

    setConfirming(true);
    verifyPlanPayment({ data: { reference } })
      .catch(() => {})
      .finally(() => {
        // Drop the reference so a later revisit/refresh of this page doesn't
        // try to re-verify a stale one, then do a full reload — the admin
        // shell's sidebar only fetches its module list once on mount, so a
        // reload is the reliable way to make it pick up the new plan.
        window.history.replaceState({}, "", window.location.pathname);
        window.location.reload();
      });
  }, []);

  async function subscribe(tier: Tier) {
    setSubscribing(tier.id);
    setError("");
    try {
      const isFree = tier.monthly_price_ngn === 0 && tier.monthly_price_usd === 0;
      if (isFree) {
        await subscribeToPlan({ data: { tierId: tier.id } });
        refresh();
      } else {
        const checkout = await startPlanCheckout({ data: { tierId: tier.id, currency, billing } });
        window.location.href = checkout.authorization_url;
        return;
      }
    } catch (err: any) {
      setError(err?.message ?? "Couldn't switch plans.");
    } finally {
      setSubscribing(null);
    }
  }

  if (confirming) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="font-display text-lg font-semibold">Confirming your payment…</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This only takes a moment. We're checking with Paystack and unlocking your plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Subscription</h1>
        <p className="text-sm text-muted-foreground">
          {!community
            ? "Pick a plan to keep your full feature set."
            : community.onTrial
              ? `You're on a ${community.trialDaysLeft}-day trial. Pick a plan to keep your full feature set.`
              : `You're on the ${community.tierName ?? "current"} plan.`}
        </p>
      </header>

      {community?.onTrial ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-warning-foreground">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" /> Trial ends in {community.trialDaysLeft} days — choose a plan to avoid interruption.
          </p>
          <PlanControls currency={currency} setCurrency={setCurrency} billing={billing} setBilling={setBilling} />
        </div>
      ) : community?.isPaidTier && community.renewsAt ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4" />
            {community.renewalDaysLeft != null && community.renewalDaysLeft > 0
              ? `Renews in ${community.renewalDaysLeft} day${community.renewalDaysLeft === 1 ? "" : "s"} — ${new Date(community.renewsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
              : `Renewal was due ${new Date(community.renewsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} — reach out whenever you're ready to renew.`}
          </p>
          <PlanControls currency={currency} setCurrency={setCurrency} billing={billing} setBilling={setBilling} />
        </div>
      ) : community ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-muted-foreground">You're on the {community.tierName ?? "free"} plan.</p>
          <PlanControls currency={currency} setCurrency={setCurrency} billing={billing} setBilling={setBilling} />
        </div>
      ) : null}

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((p) => {
          const isCurrent = p.id === community?.tierId;
          return (
            <div key={p.id} className={`relative rounded-2xl border p-6 shadow-soft ${isCurrent ? "border-primary bg-gradient-hero text-primary-foreground shadow-elegant" : "border-border bg-card"}`}>
              {isCurrent && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Current</span>
              )}
              {(() => {
                const monthly = currency === "USD" ? p.monthly_price_usd : p.monthly_price_ngn;
                const shown = billing === "yearly" ? monthly * 10 : monthly;
                const sym = currency === "USD" ? "$" : "₦";
                return (
                  <>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isCurrent ? "text-primary-foreground/70" : "text-accent"}`}>{p.name}</p>
                    <p className="mt-3 font-display text-4xl font-bold">
                      {sym}{shown.toLocaleString()}
                      <span className={`text-sm font-medium ${isCurrent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {billing === "yearly" ? "/yr" : "/mo"}
                      </span>
                    </p>
                    {billing === "yearly" && monthly > 0 && (
                      <p className={`mt-0.5 text-xs ${isCurrent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {sym}{monthly.toLocaleString()}/mo · 2 months free
                      </p>
                    )}
                  </>
                );
              })()}
              <p className={`mt-1 text-xs ${isCurrent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                Up to {p.maxMembers == null ? "unlimited" : p.maxMembers.toLocaleString()} members
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.modules.length === 0 && <li className="text-muted-foreground">No modules configured yet.</li>}
                {p.modules.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isCurrent ? "text-accent" : "text-success"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => subscribe(p)}
                disabled={isCurrent || subscribing === p.id}
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold disabled:opacity-70 ${
                  isCurrent ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                {isCurrent ? "Current plan" : subscribing === p.id ? "Redirecting…" : `Switch to ${p.name}`}
              </button>
            </div>
          );
        })}
        {tiers.length === 0 && (
          <p className="text-sm text-muted-foreground">No plans are available right now — check back soon.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Switching to a priced plan takes you to a secure Paystack checkout — your plan updates automatically once payment is confirmed.
        </p>
      </div>
    </div>
  );
}

function PlanControls({
  currency,
  setCurrency,
  billing,
  setBilling,
}: {
  currency: "USD" | "NGN";
  setCurrency: (c: "USD" | "NGN") => void;
  billing: "monthly" | "yearly";
  setBilling: (b: "monthly" | "yearly") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs">
        {(["USD", "NGN"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={`rounded-full px-3 py-1 font-semibold ${currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {c === "USD" ? "$ USD" : "₦ NGN"}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs">
        {(["monthly", "yearly"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            className={`rounded-full px-3 py-1 font-semibold capitalize ${billing === b ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}
