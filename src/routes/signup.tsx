import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingNav } from "@/components/marketing-nav";
import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

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
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("Estate");
  const [payments, setPayments] = useState("Not sure");
  const [generatedId, setGeneratedId] = useState("");
  const [communityId, setCommunityId] = useState("");

  const nameValid = /^[A-Za-z0-9\-&' ]+$/.test(name) && name.trim().length >= 5;
  const showNameError = name.length > 0 && !nameValid;

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameValid) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <MarketingNav />
        <section className="mx-auto max-w-xl px-6 py-24 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">Check your email</h1>
          <p className="mt-3 text-muted-foreground">
            We've sent a verification link to confirm your community. Your <span className="font-semibold text-foreground">14-day Enterprise trial</span> starts the moment you verify.
          </p>
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-left shadow-soft">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Community</p>
            <p className="mt-1 font-display text-lg font-semibold">{name}</p>
            <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Community ID</p>
            <p className="mt-1 font-mono text-sm">{communityId || generatedId || "—"}</p>
          </div>
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
          >
            Continue to admin console
          </button>
        </section>
      </div>
    );
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
              <input required pattern="[A-Za-z\s'\-]+" className="input" placeholder="Jane Doe" />
            </Field>
            <Field label="Contact Email *">
              <input required type="email" className="input" placeholder="jane@example.com" />
            </Field>
          </div>

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


          <Field label="Will you collect payments or donations?">
            <div className="flex gap-2">
              {["Yes", "No", "Not sure"].map((opt) => (
                <label
                  key={opt}
                  className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition ${
                    payments === opt ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  <input type="radio" name="payments" checked={payments === opt} onChange={() => setPayments(opt)} className="sr-only" />
                  {opt}
                </label>
              ))}
            </div>
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">By submitting you agree to our terms and privacy.</p>
            <button
              type="submit"
              disabled={!nameValid}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-40"
            >
              Create community & start trial
            </button>
          </div>
        </form>
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
