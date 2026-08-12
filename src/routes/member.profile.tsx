import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/lib/membership/members.functions";
import { ChangePasswordCard } from "@/components/change-password-card";
import { Pencil, Save, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/member/profile")({
  component: Profile,
});

type Me = Awaited<ReturnType<typeof getMyProfile>>;

function Profile() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  function refresh() {
    getMyProfile().then(setMe);
  }
  useEffect(refresh, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">My profile</h1>
          <p className="text-sm text-muted-foreground">
            {me?.communityName ? `Your details at ${me.communityName}.` : "Your details on file with your community."}
          </p>
        </div>
        {me && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-soft hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit profile
          </button>
        )}
      </header>

      {!me ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">
            {me === undefined ? "Loading…" : "No profile data yet."}
          </p>
        </div>
      ) : editing ? (
        <EditForm
          me={me}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-accent text-xl font-bold text-primary-foreground">
              {me.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{me.name}</h2>
              <p className="text-sm text-muted-foreground">{me.role || "Member"} · member since {me.joined || "—"}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm md:grid-cols-2">
            <Item label="Email" value={me.email || "—"} />
            <Item label="Phone" value={me.phone || "—"} />
            <Item label="WhatsApp" value={me.whatsapp || "—"} />
            <Item label="Date of Birth" value={me.dob || "—"} />
            <Item label="Country" value={me.country || "—"} />
            <Item label="Address" value={me.address || "—"} />
            <Item label="Chapter" value={me.chapter || "—"} />
            <Item label="Status" value={me.status} />
          </dl>
        </div>
      )}

      {me && <ChangePasswordCard />}
    </div>
  );
}

function EditForm({ me, onCancel, onSaved }: { me: NonNullable<Me>; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: me.name,
    phone: me.phone,
    whatsapp: me.whatsapp,
    dob: me.dob,
    country: me.country,
    address: me.address,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Name is required.");
    setSaving(true);
    try {
      await updateMyProfile({
        data: {
          name: form.name.trim(),
          phone: form.phone || undefined,
          whatsapp: form.whatsapp || undefined,
          dob: form.dob || undefined,
          country: form.country || undefined,
          address: form.address || undefined,
        },
      });
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save your changes.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name">
          <input value={form.name} onChange={set("name")} className="input" />
        </Field>
        <Field label="Email (can't be changed here)">
          <input value={me.email} disabled className="input bg-muted text-muted-foreground" />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={set("phone")} className="input" placeholder="+234…" />
        </Field>
        <Field label="WhatsApp">
          <input value={form.whatsapp} onChange={set("whatsapp")} className="input" placeholder="+234…" />
        </Field>
        <Field label="Date of birth">
          <input type="date" value={form.dob} onChange={set("dob")} className="input" />
        </Field>
        <Field label="Country">
          <input value={form.country} onChange={set("country")} className="input" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Address">
            <input value={form.address} onChange={set("address")} className="input" />
          </Field>
        </div>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
    </form>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
