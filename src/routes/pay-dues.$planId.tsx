import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startDuesCheckout } from "@/lib/payments/dues.functions";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/pay-dues/$planId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("dues_plans")
      .select("id, name, amount_ngn, amount_usd, interval, active")
      .eq("id", params.planId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !data.active) throw notFound();
    return { plan: data };
  },
  component: PayDuesPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-display text-2xl font-bold">Plan not found</h1>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-display text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function PayDuesPage() {
  const { plan } = Route.useLoaderData();
  const start = useServerFn(startDuesCheckout);
  const acceptNgn = !!plan.amount_ngn;
  const acceptUsd = !!plan.amount_usd;
  const [currency, setCurrency] = useState<"NGN" | "USD">(acceptNgn ? "NGN" : "USD");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amount = currency === "NGN" ? Number(plan.amount_ngn) : Number(plan.amount_usd);

  const submit = async () => {
    setErr(null);
    if (!name || !email) return setErr("Enter your name and email");
    setLoading(true);
    try {
      const res = await start({
        data: { plan_id: plan.id, currency, member_name: name, member_email: email },
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
          <Wallet className="h-6 w-6 text-primary" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {plan.interval} dues
          </p>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold">{plan.name}</h1>

        <div className="mt-6 space-y-4">
          {acceptNgn && acceptUsd && (
            <div className="flex gap-2">
              <Chip active={currency === "NGN"} onClick={() => setCurrency("NGN")}>
                ₦ NGN
              </Chip>
              <Chip active={currency === "USD"} onClick={() => setCurrency("USD")}>
                $ USD
              </Chip>
            </div>
          )}
          <div className="rounded-2xl bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground">You'll pay</p>
            <p className="font-display text-3xl font-bold">
              {currency === "NGN" ? "₦" : "$"}
              {amount.toLocaleString()}
            </p>
          </div>
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
            {loading ? "Redirecting…" : "Pay dues"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Secure checkout powered by Paystack
          </p>
        </div>
      </div>
      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
    </div>
  );
}

function Chip({
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
