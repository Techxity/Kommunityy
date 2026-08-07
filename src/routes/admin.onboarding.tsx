import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GripVertical, Plus, Trash2, Link2, Copy, Settings2, ExternalLink, Check } from "lucide-react";
import { listMyChapters } from "@/lib/membership/chapters.functions";
import { getMyOnboardingFields, saveOnboardingFields, getMyCommunity } from "@/lib/payments/communities.functions";
import { FIELD_LIBRARY, type FieldName } from "@/lib/onboarding-fields";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/onboarding")({
  beforeLoad: () => requireModule("Onboarding Form"),
  component: OnboardingForm,
});

function OnboardingForm() {
  const [active, setActive] = useState<FieldName[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getMyOnboardingFields(), getMyCommunity(), listMyChapters()])
      .then(([fields, community, chaptersList]) => {
        setActive((fields.fields as FieldName[]) ?? []);
        setCommunityId(fields.communityId ?? community?.id ?? "");
        setCommunityName(community?.name ?? "");
        setChapters(chaptersList);
      })
      .finally(() => setLoaded(true));
  }, []);

  const formUrl =
    (typeof window !== "undefined" ? window.location.origin : "https://kinfolk.app") +
    `/join/${communityId}`;

  function toggle(f: FieldName) {
    setActive((prev) => {
      const next = prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f];
      saveOnboardingFields({ data: { fields: next } }).catch(() => {
        // Revert locally if the save fails, so the UI doesn't lie about what's saved.
        setActive(prev);
      });
      return next;
    });
  }

  function copyLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(formUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Member onboarding form</h1>
        <p className="text-sm text-muted-foreground">
          Pick the fields new members fill out when joining your community. Share the link — submissions land in{" "}
          <Link to="/admin/members/pending" className="font-semibold text-primary hover:underline">Pending approvals</Link>.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold">Form fields</h2>
            <p className="mt-1 text-xs text-muted-foreground">Click to remove.</p>
            <ul className="mt-4 space-y-2">
              {active.map((f) => (
                <li key={f} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{f}</span>
                  {f === "Chapter" && (
                    <Link
                      to="/admin/chapters"
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/15"
                    >
                      <Settings2 className="h-2.5 w-2.5" /> Manage list
                    </Link>
                  )}
                  <button onClick={() => toggle(f)} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {loaded && active.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No fields yet — add some from the library →
                </p>
              )}
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
            <p className="mt-2 break-all rounded-lg bg-primary-foreground/10 p-3 text-xs">{communityId ? formUrl : "Loading…"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={copyLink}
                disabled={!communityId}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy link"}
              </button>
              {communityId && (
                <Link
                  to="/join/$communityId"
                  params={{ communityId }}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold text-primary-foreground ring-1 ring-primary-foreground/20"
                >
                  <ExternalLink className="h-3 w-3" /> Open public page
                </Link>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Preview</p>
            <h3 className="mt-1 font-display text-lg font-bold">Join {communityName || "your community"}</h3>
            <div className="mt-4 space-y-3">
              {active.map((f) => (
                <div key={f}>
                  <label className="text-xs font-medium">{f}</label>
                  {f === "Chapter" ? (
                    <select className="mt-1 h-9 w-full rounded-md border border-border bg-muted/40 px-2 text-sm">
                      <option value="">Select a chapter…</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 h-9 rounded-md border border-border bg-muted/40" />
                  )}
                </div>
              ))}
              <button type="button" className="mt-2 w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">
                Submit application
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
