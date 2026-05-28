import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing-nav";
import { useState } from "react";
import { Users2, Copy, Check } from "lucide-react";
import { communityIdForEmail, isCommunityDisabled } from "@/lib/communities-store";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Kinfolk" }] }),
  component: Login,
});

// Sample accounts — role is resolved server-side from the user record
// via the Roles & Permissions module (not chosen at login).
const sampleAccounts = [
  {
    role: "Super Admin",
    email: "daniel@kinfolk.app",
    password: "demo1234",
    destination: "/super-admin",
    description: "Platform manager — full access to every community, plan and billing record.",
  },
  {
    role: "Community Admin",
    email: "adaeze@crestwood.community",
    password: "demo1234",
    destination: "/admin",
    description: "Manages the Crestwood Estate community workspace.",
  },
  {
    role: "Member",
    email: "femi@crestwood.community",
    password: "demo1234",
    destination: "/member",
    description: "Regular community member — sees dues, elections and updates.",
  },
] as const;

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const match = sampleAccounts.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!match) {
      setError("No account found for that email. Try one of the sample logins below.");
      return;
    }
    const cid = communityIdForEmail(email);
    if (isCommunityDisabled(cid)) {
      setError("This community has been disabled by the platform. Please contact your community admin.");
      return;
    }
    setError("");
    navigate({ to: match.destination });
  }

  function fillSample(acct: (typeof sampleAccounts)[number]) {
    setEmail(acct.email);
    setPassword(acct.password);
    setError("");
  }

  async function copyEmail(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="mx-auto grid max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
            <Users2 className="h-5 w-5" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One sign-in for everyone. Your role and permissions are resolved from the
            Roles &amp; Permissions module after you authenticate.
          </p>

          <form
            onSubmit={submit}
            className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
          >
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@community.com"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-foreground hover:text-accent">
              Create a community
            </Link>
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Demo accounts
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click any account to autofill the form. Password is{" "}
            <span className="font-mono text-foreground">demo1234</span> for all.
          </p>

          <ul className="mt-5 space-y-3">
            {sampleAccounts.map((acct) => (
              <li
                key={acct.role}
                className="group rounded-xl border border-border bg-card p-4 shadow-soft transition hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold">{acct.role}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {acct.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="truncate rounded bg-muted px-2 py-1 text-[11px]">
                        {acct.email}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyEmail(acct.email)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Copy email"
                      >
                        {copied === acct.email ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillSample(acct)}
                    className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-primary hover:text-primary-foreground"
                  >
                    Use
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            In production, the same /login route authenticates every user. The Roles
            &amp; Permissions module determines whether they land on the Super Admin,
            Community Admin or Member workspace.
          </p>
        </div>
      </section>
    </div>
  );
}
