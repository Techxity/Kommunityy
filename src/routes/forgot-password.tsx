import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing-nav";
import { useState } from "react";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth/auth.functions";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — Kommunity" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset({ data: { email } });
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="mx-auto max-w-md px-6 py-16">
        {sent ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-success">
              <MailCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent a link to reset your password. It expires in 1 hour.
            </p>
            <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-accent">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold">Forgot your password?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we'll send you a link to set a new one.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@community.com"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>
              {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Remembered it?{" "}
              <Link to="/login" className="font-semibold text-foreground hover:text-accent">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
