import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Plus, Trash2, Users, Pencil, X, Check } from "lucide-react";
import { listMyChapters, createChapter, updateChapter, deleteChapter } from "@/lib/membership/chapters.functions";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/chapters")({
  beforeLoad: () => requireModule("Membership"),
  component: ChaptersPage,
});

type Chapter = { id: string; name: string; region: string; coordinator: string; memberCount: number };

function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", region: "", coordinator: "" });
  const [saving, setSaving] = useState(false);

  function refresh() {
    listMyChapters().then(setChapters);
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setForm({ name: "", region: "", coordinator: "" });
    setEditingId(null);
    setShowForm(false);
  }

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateChapter({ data: { id: editingId, name: form.name, region: form.region, coordinator: form.coordinator } });
      } else {
        await createChapter({ data: { name: form.name, region: form.region, coordinator: form.coordinator } });
      }
      resetForm();
      refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(id: string) {
    const c = chapters.find((x) => x.id === id);
    if (!c) return;
    setForm({ name: c.name, region: c.region, coordinator: c.coordinator });
    setEditingId(id);
    setShowForm(true);
  }

  async function remove(id: string) {
    await deleteChapter({ data: { id } });
    refresh();
  }

  const totalMembers = chapters.reduce((s, c) => s + c.memberCount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Member Management</p>
          <h1 className="font-display text-3xl font-bold">Chapters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organise members into chapters by city or region. New members pick their chapter on the onboarding form.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> New chapter
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Chapters</p>
          <p className="mt-1 font-display text-2xl font-bold">{chapters.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Members assigned</p>
          <p className="mt-1 font-display text-2xl font-bold">{totalMembers}</p>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-hero p-4 text-primary-foreground shadow-elegant">
          <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Onboarding</p>
          <p className="mt-1 text-sm">
            Add the <span className="font-semibold">Chapter</span> field to your onboarding form to let new members pick one.
          </p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              {editingId ? "Edit chapter" : "New chapter"}
            </h2>
            <button onClick={resetForm} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-medium">Chapter name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Lagos Chapter"
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Region / city</label>
              <input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="e.g. South West, Nigeria"
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Coordinator</label>
              <input
                value={form.coordinator}
                onChange={(e) => setForm({ ...form, coordinator: e.target.value })}
                placeholder="Member name"
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-full border border-border px-4 py-2 text-sm font-medium">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" /> {editingId ? "Save changes" : "Create chapter"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Chapter</th>
              <th className="px-5 py-3">Region</th>
              <th className="px-5 py-3">Coordinator</th>
              <th className="px-5 py-3">Members</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {c.name}
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{c.region}</td>
                <td className="px-5 py-3">{c.coordinator || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    <Users className="h-3 w-3" /> {c.memberCount}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => startEdit(c.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {chapters.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No chapters yet. Create your first one to enable the chapter dropdown on the onboarding form.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
