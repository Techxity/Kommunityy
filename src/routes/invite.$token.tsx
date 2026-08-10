import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Users2 } from "lucide-react";
import { getInviteInfo, acceptMemberInvite } from "@/lib/membership/member-accounts.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Set your password — Kommunity" }] }),
  component: AcceptInvite,
});

type InviteInfo = { name: string; email: string; communityName: string; communitySlug: string };

function AcceptInvite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getInviteInfo({ data: { token } }).then(setInfo);
  }, [token]);

  const loginUrl =
    info && typeof window !== "undefined" ? `${window.location.origin}/l/${info.communitySlug}` : "";

  function copyLoginUrl() {
    if (typeof navigator !== "undefined" && navigator.clipboard && loginUrl) {
      navigator.clipboard.writeText(loginUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    try {
      // acceptMemberInvite already logs them in (sets the session cookie),
      // so there's no need to make them sign in again — show them where to
      // come back next time, then send them straight into the portal.
      await acceptMemberInvite({ data: { token, password } });
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't set your password. Please try again.");
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
            It may have expired or already been used. Ask your community admin to resend your invite.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <section className="mx-auto max-w-md px-6 py-16">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
            <Check className="h-5 w-5" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">You're all set, {info.name.split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password is saved. Next time, sign in at {info.communityName}'s own login page instead of hunting for the invite link.
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">{info.communityName}'s login page</p>
            <p className="mt-2 break-all rounded-lg bg-primary-foreground/10 p-3 text-sm">{loginUrl}</p>
            <button
              onClick={copyLoginUrl}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <button
            onClick={() => navigate({ to: "/member" })}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Continue to your dashboard
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto max-w-md px-6 py-16">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
          <Users2 className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold">Welcome, {info.name.split(" ")[0]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set a password to access your {info.communityName} member portal.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input disabled value={info.email} className="mt-2 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm password</label>
            <input
              required
              type="password"
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
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Setting up…" : "Set password & continue"}
          </button>
        </form>
      </section>
    </div>
  );
}
