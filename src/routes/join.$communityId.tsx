import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Users2, ShieldCheck, Sparkles } from "lucide-react";
import { community } from "@/lib/mock-data";
import { useOnboardingFields } from "@/lib/onboarding-store";
import { useChapters } from "@/lib/chapters-store";
import { pendingMembersStore } from "@/lib/pending-members-store";

export const Route = createFileRoute("/join/$communityId")({
  component: PublicJoinPage,
  head: ({ params }) => ({
    meta: [
      { title: `Join ${community.name} — Kinfolk` },
      { name: "description", content: `Apply to join ${community.name}. Quick onboarding, secure handling, reviewed by your community admin.` },
      { property: "og:title", content: `Join ${community.name}` },
      { property: "og:description", content: `Apply to join the ${community.name} community on Kinfolk.` },
      { name: "robots", content: "noindex" }, // prototype
      { name: "x-community", content: params.communityId },
    ],
  }),
});

const INPUT_TYPES: Record<string, string> = {
  Email: "email",
  "Phone number": "tel",
  "WhatsApp Number": "tel",
  "Date of Birth": "date",
  "Year of Graduation": "number",
  "Year of joining group": "number",
};

function PublicJoinPage() {
  const fields = useOnboardingFields();
  const chapters = useChapters();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const required = useMemo(() => fields.filter((f) => f === "Name" || f === "Email" || f === "Phone number"), [fields]);

  function set(f: string, v: string) {
    setValues((prev) => ({ ...prev, [f]: v }));
    if (errors[f]) setErrors((prev) => ({ ...prev, [f]: "" }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of required) if (!values[f]?.trim()) errs[f] = "Required";
    if (values["Email"] && !/^\S+@\S+\.\S+$/.test(values["Email"])) errs["Email"] = "Enter a valid email";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    pendingMembersStore.add({
      data: values,
      chapterId: values["Chapter"] || undefined,
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-hero text-primary-foreground">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">You're on the list</h1>
          <p className="mt-3 max-w-sm text-sm text-primary-foreground/80">
            Thanks for applying to <span className="font-semibold">{community.name}</span>. A community admin will review your details
            and confirm your membership shortly. We'll be in touch on the email and phone number you provided.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-5 py-2.5 text-sm font-semibold text-primary"
          >
            Back to Kinfolk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Hero */}
      <div className="bg-gradient-hero text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/15 ring-1 ring-primary-foreground/20">
              <Users2 className="h-4 w-4" />
            </span>
            <p className="font-display text-base font-semibold">Kinfolk</p>
          </div>
          <p className="mt-8 text-xs uppercase tracking-[0.2em] text-primary-foreground/70">{community.type} · Membership application</p>
          <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">Join {community.name}</h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/85 md:text-base">
            Fill out the short form below. Your details go straight to the community admins for review — no account needed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-primary-foreground/85">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 ring-1 ring-primary-foreground/15">
              <ShieldCheck className="h-3 w-3" /> Reviewed by your admin
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 ring-1 ring-primary-foreground/15">
              <Sparkles className="h-3 w-3" /> Takes under 2 minutes
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto -mt-8 max-w-3xl px-6 pb-16">
        <form
          onSubmit={submit}
          className="rounded-3xl border border-border bg-card p-6 shadow-elegant md:p-10"
        >
          <h2 className="font-display text-xl font-bold">Your details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fields marked with <span className="text-destructive">*</span> are required.
          </p>

          {fields.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              This community's onboarding form hasn't been set up yet. Please check back soon.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {fields.map((f) => {
                const isRequired = required.includes(f);
                const err = errors[f];
                const inputClass = `mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-ring ${
                  err ? "border-destructive" : "border-border"
                }`;
                return (
                  <div key={f} className={f === "Address" ? "md:col-span-2" : undefined}>
                    <label className="text-xs font-semibold text-foreground">
                      {f} {isRequired && <span className="text-destructive">*</span>}
                    </label>
                    {f === "Chapter" ? (
                      <select
                        value={values[f] ?? ""}
                        onChange={(e) => set(f, e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select a chapter…</option>
                        {chapters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.region}
                          </option>
                        ))}
                      </select>
                    ) : f === "Address" ? (
                      <textarea
                        value={values[f] ?? ""}
                        onChange={(e) => set(f, e.target.value)}
                        rows={3}
                        className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring ${
                          err ? "border-destructive" : "border-border"
                        }`}
                      />
                    ) : (
                      <input
                        type={INPUT_TYPES[f] ?? "text"}
                        value={values[f] ?? ""}
                        onChange={(e) => set(f, e.target.value)}
                        className={inputClass}
                      />
                    )}
                    {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              By submitting, you agree to share these details with the {community.name} admins for membership review.
            </p>
            <button
              type="submit"
              disabled={fields.length === 0}
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-50"
            >
              Submit application
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by <Link to="/" className="font-semibold text-foreground hover:underline">Kinfolk</Link>
        </p>
      </div>
    </div>
  );
}
