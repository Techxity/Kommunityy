import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Users2 } from "lucide-react";
import {
  getInviteInfo,
  acceptMemberInvite,
  linkExistingAccountToMembership,
} from "@/lib/membership/member-accounts.functions";
import { me } from "@/lib/auth/auth.functions";

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
  // Set when the invited email already has an account — the set-password form
  // is replaced with a "sign in to link" path, since we never reset an
  // existing account's password through an invite.
  const [existingAccount, setExistingAccount] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null | undefined>(undefined);
  const [autoLinkTried, setAutoLinkTried] = useState(false);

  useEffect(() => {
    getInviteInfo({ data: { token } }).then(setInfo);
    // If they're already signed in, we can link automatically instead of
    // asking them to set a password.
    me()
      .then((u) => setSignedInEmail(u?.email ?? null))
      .catch(() => setSignedInEmail(null));
  }, [token]);

  const emailMatchesSignedIn =
    !!signedInEmail && !!info && signedInEmail.toLowerCase() === info.email.toLowerCase();

  // Signed in as the invited email (e.g. they just came back from signing in
  // via the ?next= redirect) — link the membership automatically, no click.
  useEffect(() => {
    if (emailMatchesSignedIn && !autoLinkTried && !done && !loading) {
      setAutoLinkTried(true);
      linkMembership();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailMatchesSignedIn, autoLinkTried, done, loading]);

  async function linkMembership() {
    setError("");
    setLoading(true);
    try {
      await linkExistingAccountToMembership({ data: { token } });
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't link your membership. Please try again.");
      setLoading(false);
    }
  }

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
      // The invited email already has an account — switch to the sign-in-to-link
      // path rather than (dangerously) resetting that account's password.
      if (/already exists for this email/i.test(err?.message ?? "")) {
        setExistingAccount(true);
        setError("");
      } else {
        setError(err?.message ?? "Couldn't set your password. Please try again.");
      }
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

  // The invited email already has an account. Never reset its password via an
  // invite — either link in one click (already signed in as that email) or
  // point them to their login page to sign in first.
  if (existingAccount || (emailMatchesSignedIn && info.email)) {
    return (
      <div className="min-h-screen bg-background">
        <section className="mx-auto max-w-md px-6 py-16">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
            <Users2 className="h-5 w-5" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">Welcome back, {info.name.split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You already have an account for {info.email}. {emailMatchesSignedIn
              ? "Linking this membership to it now."
              : "Sign in with your existing password and your membership will be linked automatically."}
          </p>

          {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>}

          {emailMatchesSignedIn ? (
            error ? (
              <button
                onClick={linkMembership}
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Linking…" : "Try again"}
              </button>
            ) : (
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Linking your membership…
              </div>
            )
          ) : (
            <button
              onClick={() =>
                navigate({
                  to: "/l/$slug",
                  params: { slug: info.communitySlug },
                  search: { next: `/invite/${token}` },
                })
              }
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Go to sign in
            </button>
          )}
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
