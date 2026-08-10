import { useEffect, useState } from "react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDuesPlan, startDuesCheckout, verifyDuesPayment } from "@/lib/payments/dues.functions";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/pay-dues/$planId")({
  loader: async ({ params }) => {
    const plan = await getDuesPlan({ data: { plan_id: params.planId } });
    if (!plan) throw notFound();
    return { plan };
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

type VerifyResult = Awaited<ReturnType<typeof verifyDuesPayment>>;

function PayDuesPage() {
  const { plan } = Route.useLoaderData();
  const navigate = useNavigate();
  const start = useServerFn(startDuesCheckout);
  const acceptNgn = !!plan.amount_ngn;
  const acceptUsd = !!plan.amount_usd;
  const [currency, setCurrency] = useState<"NGN" | "USD">(acceptNgn ? "NGN" : "USD");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Paystack appends ?reference=... (and ?trxref=...) to our callback_url
  // when it redirects back here after checkout. The webhook that records
  // the payment runs async server-to-server and may not have landed yet, so
  // confirm proactively and show the payer a real status instead of just
  // dumping them back on the payment form.
  const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "success" | "failed">("idle");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) return;

    setVerifyState("verifying");
    verifyDuesPayment({ data: { reference, plan_id: plan.id } })
      .then((res) => {
        setVerifyResult(res);
        setVerifyState(res.ok && res.status === "success" ? "success" : "failed");
      })
      .catch((e: any) => {
        setVerifyErr(e.message ?? "Couldn't confirm this payment.");
        setVerifyState("failed");
      })
      .finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, [plan.id]);

  useEffect(() => {
    if (verifyState !== "success") return;
    const t = setTimeout(() => navigate({ to: "/member/dues" }), 2500);
    return () => clearTimeout(t);
  }, [verifyState, navigate]);

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

  if (verifyState === "verifying") {
    return (
      <div className="mx-auto max-w-xl p-6 md:p-10">
        <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold">Confirming your payment…</p>
          <p className="mt-1 text-xs text-muted-foreground">This only takes a moment.</p>
        </div>
      </div>
    );
  }

  if (verifyState === "success") {
    return (
      <div className="mx-auto max-w-xl p-6 md:p-10">
        <div className="rounded-3xl border border-success/30 bg-card p-8 text-center shadow-soft">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Payment successful</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {verifyResult && `${verifyResult.currency === "NGN" ? "₦" : "$"}${verifyResult.amount.toLocaleString()} received for ${plan.name}.`}
          </p>
          {verifyResult?.reference && (
            <p className="mt-1 text-xs text-muted-foreground">Reference: {verifyResult.reference}</p>
          )}
          <Button onClick={() => navigate({ to: "/member/dues" })} className="mt-6 w-full">
            View my payment history
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">Taking you there automatically…</p>
        </div>
      </div>
    );
  }

  if (verifyState === "failed") {
    return (
      <div className="mx-auto max-w-xl p-6 md:p-10">
        <div className="rounded-3xl border border-destructive/30 bg-card p-8 text-center shadow-soft">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive">
            <XCircle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Payment didn't go through</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {verifyErr ?? "We couldn't confirm this transaction as successful. No charge was recorded."}
          </p>
          {verifyResult?.reference && (
            <p className="mt-1 text-xs text-muted-foreground">Reference: {verifyResult.reference}</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => setVerifyState("idle")} className="w-full">
              Try again
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/member/dues" })} className="w-full">
              Go to my payment history
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
