import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing-nav";
import { useEffect, useState } from "react";
import { Users2, Loader2 } from "lucide-react";
import { login } from "@/lib/auth/auth.functions";
import { getCommunityBySlug } from "@/lib/payments/communities.functions";

// Branded, bookmarkable login page for one specific estate/community —
// functionally identical to /login (same login() call, same global
// email/password account), just scoped visually so members recognize it as
// "their" door in rather than the generic platform login.
export const Route = createFileRoute("/l/$slug")({
  // `next` is an optional same-origin return path (e.g. an invite the member
  // was linking). Kept in the URL so it survives the round-trip through login.
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = typeof search.next === "string" ? search.next : undefined;
    return next ? { next } : {};
  },
  component: EstateLogin,
});

type Community = Awaited<ReturnType<typeof getCommunityBySlug>>;

function EstateLogin() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCommunityBySlug({ data: { slug } }).then(setCommunity);
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login({ data: { email, password, communitySlug: slug } });
      // Honor a ?next= return path (e.g. an invite the member was linking) —
      // but only a same-origin relative path, never an absolute/external URL,
      // so this can't be abused as an open redirect.
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        window.location.href = next;
        return;
      }
      if (result.redirectTo === "/super-admin") navigate({ to: "/super-admin" });
      else if (result.redirectTo === "/admin") navigate({ to: "/admin" });
      else navigate({ to: "/member" });
    } catch (e: any) {
      setError(e?.message ?? "Could not sign in. Please try again.");
      setLoading(false);
    }
  }

  if (community === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  if (community === null) {
    return (
      <div className="min-h-screen bg-background">
        <MarketingNav />
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-2xl font-bold">We couldn't find that estate</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This login link may be out of date. Try{" "}
            <Link to="/login" className="font-semibold text-foreground hover:text-accent">
              signing in here
            </Link>{" "}
            instead, or ask your community admin for the current link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="mx-auto max-w-md px-6 py-16">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
          <Users2 className="h-5 w-5" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-accent">{community.name}</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your {community.name} member portal.
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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Bookmark this page — it's {community.name}'s dedicated sign-in link.
        </p>
      </section>
    </div>
  );
}
