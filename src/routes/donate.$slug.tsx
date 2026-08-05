import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startDonationCheckout } from "@/lib/payments/donations.functions";
import { Button } from "@/components/ui/button";
import { HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/donate/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("donations")
      .select("id, purpose, status, target_ngn, target_usd, deadline, shareable_slug")
      .eq("shareable_slug", params.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();

    // Public aggregate view — individual donor rows are admin-only.
    const { data: totals } = await supabase
      .from("donation_totals")
      .select("collected_ngn, collected_usd")
      .eq("donation_id", data.id)
      .maybeSingle();
    const collected_ngn = Number(totals?.collected_ngn ?? 0);
    const collected_usd = Number(totals?.collected_usd ?? 0);
    return { donation: data, collected_ngn, collected_usd };

  },
  component: DonatePage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-display text-2xl font-bold">Donation not found</h1>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-display text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function DonatePage() {
  const { donation, collected_ngn, collected_usd } = Route.useLoaderData();
  const start = useServerFn(startDonationCheckout);
  const [currency, setCurrency] = useState<"NGN" | "USD">(
    donation.target_ngn ? "NGN" : "USD",
  );
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const acceptNgn = !!donation.target_ngn;
  const acceptUsd = !!donation.target_usd;
  const closed = donation.status !== "active";

  const submit = async () => {
    setErr(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr("Enter a valid amount");
    if (!name || !email) return setErr("Enter your name and email");
    setLoading(true);
    try {
      const res = await start({
        data: { slug: donation.shareable_slug, currency, amount: amt, payer_name: name, payer_email: email },
      });
      window.location.href = res.authorization_url;
    } catch (e: any) {
      setErr(e.message ?? "Could not start checkout");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 md:p-10">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <HeartHandshake className="h-6 w-6 text-accent" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {closed ? "Closed" : "Donation campaign"}
          </p>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold">{donation.purpose}</h1>
        {donation.deadline && (
          <p className="mt-1 text-sm text-muted-foreground">Closes {donation.deadline}</p>
        )}

        <div className="mt-6 space-y-3">
          {acceptNgn && (
            <ProgressRow label="₦" collected={collected_ngn} target={Number(donation.target_ngn)} />
          )}
          {acceptUsd && (
            <ProgressRow label="$" collected={collected_usd} target={Number(donation.target_usd)} />
          )}
        </div>

        {!closed && (
          <div className="mt-8 space-y-4">
            {acceptNgn && acceptUsd && (
              <div className="flex gap-2">
                <CurrencyChip active={currency === "NGN"} onClick={() => setCurrency("NGN")}>
                  ₦ NGN
                </CurrencyChip>
                <CurrencyChip active={currency === "USD"} onClick={() => setCurrency("USD")}>
                  $ USD
                </CurrencyChip>
              </div>
            )}
            <Field label={`Amount (${currency === "NGN" ? "₦" : "$"})`}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={currency === "NGN" ? "5000" : "20"}
              />
            </Field>
            <Field label="Your name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button onClick={submit} disabled={loading} className="w-full">
              {loading ? "Redirecting…" : `Donate ${currency === "NGN" ? "₦" : "$"}${amount || "0"}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Secure checkout powered by Paystack
            </p>
          </div>
        )}
      </div>
      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
    </div>
  );
}

function ProgressRow({ label, collected, target }: { label: string; collected: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-xl font-bold">
          {label}
          {collected.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">
          / {label}
          {target.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-gradient-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CurrencyChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
