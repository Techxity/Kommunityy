import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GripVertical, Plus, Trash2, Link2, Copy, Settings2 } from "lucide-react";
import { useChapters } from "@/lib/chapters-store";

export const Route = createFileRoute("/admin/onboarding")({
  component: OnboardingForm,
});

const FIELD_LIBRARY = [
  "Name", "Phone number", "Email", "Address", "WhatsApp Number",
  "Date of Birth", "Chapter", "Year of Graduation", "Year of joining group",
  "Matriculation number", "Who invited you?", "Occupation",
];

function OnboardingForm() {
  const [active, setActive] = useState<string[]>(["Name", "Email", "Phone number", "WhatsApp Number", "Date of Birth"]);
  const formUrl = "https://kinfolk.app/c/CRE-2024-001/join";

  function toggle(f: string) {
    setActive((cur) => cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f]);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Member onboarding form</h1>
        <p className="text-sm text-muted-foreground">Pick the fields new members fill out when joining your community.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold">Form fields</h2>
            <p className="mt-1 text-xs text-muted-foreground">Drag to reorder. Click to remove.</p>
            <ul className="mt-4 space-y-2">
              {active.map((f) => (
                <li key={f} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{f}</span>
                  <button onClick={() => toggle(f)} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {active.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No fields yet — add some from the library →</p>}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold">Field library</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {FIELD_LIBRARY.filter((f) => !active.includes(f)).map((f) => (
                <button
                  key={f}
                  onClick={() => toggle(f)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="h-3 w-3" /> {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
            <Link2 className="h-5 w-5 opacity-80" />
            <p className="mt-3 text-xs uppercase tracking-wider text-primary-foreground/70">Shareable form link</p>
            <p className="mt-2 break-all rounded-lg bg-primary-foreground/10 p-3 text-xs">{formUrl}</p>
            <button className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
              <Copy className="h-3 w-3" /> Copy link
            </button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Preview</p>
            <h3 className="mt-1 font-display text-lg font-bold">Join Crestwood Estate Residents</h3>
            <div className="mt-4 space-y-3">
              {active.map((f) => (
                <div key={f}>
                  <label className="text-xs font-medium">{f}</label>
                  <div className="mt-1 h-9 rounded-md border border-border bg-muted/40" />
                </div>
              ))}
              <button className="mt-2 w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">Join community</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
