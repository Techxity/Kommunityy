import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing-nav";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { signup } from "@/lib/auth/auth.functions";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your community — Kinfolk" },
      { name: "description", content: "Sign up your community in minutes and start a 14-day Enterprise trial." },
    ],
  }),
  component: Signup,
});

const TYPES = ["Community of Tenants", "Alumni group", "Fellowship", "Religious Community", "Estate", "Cooperative", "Others"];
const COUNTRIES = ["Nigeria", "United States", "United Kingdom", "Canada", "Ghana", "Kenya", "South Africa"];
const DIAL = [
  { c: "NG", code: "+234" },
  { c: "US", code: "+1" },
  { c: "UK", code: "+44" },
  { c: "GH", code: "+233" },
  { c: "KE", code: "+254" },
  { c: "ZA", code: "+27" },
];

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState("Estate");
  const [pricingPlan, setPricingPlan] = useState("");
  const [generatedId, setGeneratedId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nameValid = /^[A-Za-z0-9\-&' ]+$/.test(name) && name.trim().length >= 5;
  const showNameError = name.length > 0 && !nameValid;
  const pricingValid = pricingPlan !== "";
  const passwordValid = password.length >= 8;

  function generateId() {
    const slug = name
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .toUpperCase()
      .slice(0, 8) || "KIN";
    const rand = Math.floor(1000 + Math.random() * 9000);
    setGeneratedId(`${slug}-${rand}`);
    setCommunityId(`${slug}-${rand}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameValid || !pricingValid || !passwordValid || !contactName || !contactEmail) return;
    setError("");
    setLoading(true);
    try {
      await signup({
        data: {
          communityName: name,
          communityType: type,
          name: contactName,
          email: contactEmail,
          password,
        },
      });
      navigate({ to: "/admin" });
    } catch (err: any) {
      setError(err?.message ?? "Could not create your community. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="mx-auto max-w-3xl px-6 py-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Create your community</h1>
        <p className="mt-2 text-muted-foreground">
          Start a 14-day Enterprise trial. No credit card required.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6 rounded-3xl border border-border bg-card p-8 shadow-soft">
          <Field label="Community Full Name *" hint="Min 5 chars · letters, numbers, hyphens, & and ' only">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Crestwood Estate Residents"
              className="input"
            />
            {showNameError && <p className="mt-1 text-xs text-destructive">Name must be at least 5 characters and only use letters, numbers, - & '</p>}
          </Field>

          <Field label="Community ID (optional)" hint="Leave empty and we'll generate one">
            <div className="flex gap-2">
              <input
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                placeholder={generatedId || "Auto-generated"}
                className="input flex-1"
              />
              <button type="button" onClick={generateId} className="rounded-lg border border-border bg-secondary px-3 text-xs font-semibold hover:bg-muted">
                Generate
              </button>
            </div>
          </Field>

          <Field label="Community Type *">
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <label
                  key={t}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
                    type === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="sr-only"
                  />
                  {t}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Description">
            <textarea rows={4} className="input resize-y" placeholder="Tell us about your community…" />
          </Field>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Contact Full Name *">
              <input
                required
                pattern="[A-Za-z\s'\-]+"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="input"
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Contact Email *">
              <input
                required
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="input"
                placeholder="jane@example.com"
              />
            </Field>
          </div>

          <Field label="Password *" hint="Min 8 characters — this is what you'll use to sign in">
            <input
              required
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </Field>

          <Field label="Contact Phone *">
            <div className="flex gap-2 w-full">
              <select className="input shrink-0" style={{ width: "6rem" }} defaultValue="+234">
                {DIAL.map((d) => (
                  <option key={d.c} value={d.code}>{d.c} {d.code}</option>
                ))}
              </select>
              <input
                required
                type="tel"
                inputMode="tel"
                pattern="[0-9 ()+\-]{6,}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                style={{ flex: "1 1 0%", minWidth: 0 }}
                placeholder="803 000 0000"
              />
            </div>
          </Field>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Country">
              <select className="input">
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Address (optional)">
              <input className="input" placeholder="Street, city" />
            </Field>
          </div>



          <Field label="Select Pricing Plan *" hint="You'll only be charged after your 14-day trial ends">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { key: "free", name: "Free", price: "$0/mo", desc: "Up to 50 members" },
                { key: "basic", name: "Basic", price: "$29/mo", desc: "Up to 500 members" },
                { key: "enterprise", name: "Enterprise", price: "$99/mo", desc: "Unlimited members" },
              ].map((plan) => (
                <label
                  key={plan.key}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    pricingPlan === plan.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="pricing"
                    value={plan.key}
                    checked={pricingPlan === plan.key}
                    onChange={() => setPricingPlan(plan.key)}
                    className="sr-only"
                  />
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.desc}</p>
                  <p className="mt-2 text-sm font-bold text-primary">{plan.price}</p>
                </label>
              ))}
            </div>
          </Field>

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">By submitting you agree to our terms and privacy.</p>
            <button
              type="submit"
              disabled={!nameValid || !pricingValid || !passwordValid || loading}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-40"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Creating…" : "Create community & start trial"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-foreground hover:text-accent">
            Sign in
          </Link>
        </p>
      </section>
      <style>{`.input{width:100%;border-radius:0.625rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.6rem 0.8rem;font-size:0.875rem;outline:none;transition:border-color .15s, box-shadow .15s}.input:focus{border-color:var(--color-ring);box-shadow:0 0 0 3px color-mix(in oklab, var(--color-ring) 25%, transparent)}`}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
