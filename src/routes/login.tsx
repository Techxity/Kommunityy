import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing-nav";
import { useState } from "react";
import { Users2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Kinfolk" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"super" | "admin" | "member">("admin");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (role === "super") navigate({ to: "/super-admin" });
    else if (role === "admin") navigate({ to: "/admin" });
    else navigate({ to: "/member" });
  }

  const roleLabels = { super: "Super Admin", admin: "Community Admin", member: "Member" } as const;

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="mx-auto flex max-w-md flex-col px-6 py-20">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-primary-foreground shadow-soft">
          <Users2 className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your Kinfolk workspace.</p>

        <div className="mt-8 inline-flex rounded-full border border-border bg-card p-1 text-xs">
          {(["super", "admin", "member"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${
                role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {roleLabels[r]}
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Demo: any credentials work — pick a role above to enter that portal.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input required type="email" placeholder="you@community.com" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input required type="password" placeholder="••••••••" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
          </div>
          <button type="submit" className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-foreground hover:text-accent">Create a community</Link>
        </p>
      </section>
    </div>
  );
}
