import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Check } from "lucide-react";
import { getResetInfo, resetPassword } from "@/lib/auth/auth.functions";
import { PasswordInput } from "@/components/password-input";

export const Route = createFileRoute("/reset-password/$token")({
  head: () => ({ meta: [{ title: "Reset password — Kommunity" }] }),
  component: ResetPassword,
});

type ResetInfo = { email: string } | null;

function ResetPassword() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<ResetInfo | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getResetInfo({ data: { token } }).then(setInfo).catch(() => setInfo(null));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      // resetPassword signs the user in and returns their roles, so we can
      // send them straight to the right home.
      const res = await resetPassword({ data: { token, password } });
      if (res.isSuperAdmin) navigate({ to: "/super-admin" });
      else if (res.communityAdminOf) navigate({ to: "/admin" });
      else navigate({ to: "/member" });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't reset your password. Please try again.");
      setLoading(false);
    }
  }

  if (info === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  if (info === null) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-2xl font-bold">This link isn't valid</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            It may have expired or already been used. Request a fresh reset link and try again.
          </p>
          <Link to="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-accent">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto max-w-md px-6 py-16">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a new password for <span className="font-medium text-foreground">{info.email}</span>.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div>
            <label className="text-sm font-medium">New password</label>
            <PasswordInput
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm new password</label>
            <PasswordInput
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {loading ? "Saving…" : "Reset password & sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
