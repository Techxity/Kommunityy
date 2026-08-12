import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyCommunity, updateCommunityBasics } from "@/lib/payments/communities.functions";
import { ChangePasswordCard } from "@/components/change-password-card";
import { Copy, Check, Save } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: Settings,
});

const TYPES = ["Community of Tenants", "Alumni group", "Fellowship", "Religious Community", "Estate", "Cooperative", "Others"];

function Settings() {
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyCommunity().then((c) => {
      if (c) {
        setName(c.name);
        setType(c.type);
        setSlug(c.slug);
      }
      setLoaded(true);
    });
  }, []);

  const loginUrl = slug ? `${typeof window !== "undefined" ? window.location.origin : "https://kommunity.app"}/l/${slug}` : "";

  function copyLoginUrl() {
    if (typeof navigator !== "undefined" && navigator.clipboard && loginUrl) {
      navigator.clipboard.writeText(loginUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateCommunityBasics({ data: { name, type: type || undefined } });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Community settings</h1>
        <p className="text-sm text-muted-foreground">Basic details about your community.</p>
      </header>

      <div className="rounded-2xl border border-border bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
        <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Your members' login page</p>
        <p className="mt-2 break-all rounded-lg bg-primary-foreground/10 p-3 text-sm">{loginUrl || "Loading…"}</p>
        <p className="mt-3 text-xs text-primary-foreground/70">
          Share this link with members instead of the generic sign-in page — it's unique to {name || "your community"} and works with the account they already set up.
        </p>
        <button
          onClick={copyLoginUrl}
          disabled={!loginUrl}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div>
          <label className="text-sm font-medium">Community name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Community type</label>
          <div className="mt-2 flex flex-wrap gap-2">
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
          <p className="mt-2 text-xs text-muted-foreground">
            Shown on your public join page and in the platform's community list. Doesn't change any features.
          </p>
        </div>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        {saved && <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">Saved.</p>}

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <ChangePasswordCard />
    </div>
  );
}
