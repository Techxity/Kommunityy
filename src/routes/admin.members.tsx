import { createFileRoute, Link } from "@tanstack/react-router";
import { members } from "@/lib/mock-data";
import { useMemo, useState } from "react";
import { Search, Upload, Send, Edit2, UserX, Plus, X, ClipboardList, Filter, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/admin/members")({
  component: MembersPage,
});

function MembersPage() {
  const [query, setQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [chapterFilter, setChapterFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const chapters = useMemo(() => Array.from(new Set(members.map((m) => m.chapter).filter(Boolean))), []);
  const countries = useMemo(() => Array.from(new Set(members.map((m) => m.country).filter(Boolean))), []);
  const roles = useMemo(() => Array.from(new Set(members.map((m) => m.role).filter(Boolean))), []);
  const statuses = useMemo(() => Array.from(new Set(members.map((m) => m.status).filter(Boolean))), []);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesQuery = [m.name, m.email, m.role].some((f) => f.toLowerCase().includes(query.toLowerCase()));
      const matchesChapter = !chapterFilter || m.chapter === chapterFilter;
      const matchesCountry = !countryFilter || m.country === countryFilter;
      const matchesRole = !roleFilter || m.role === roleFilter;
      const matchesStatus = !statusFilter || m.status === statusFilter;
      return matchesQuery && matchesChapter && matchesCountry && matchesRole && matchesStatus;
    });
  }, [query, chapterFilter, countryFilter, roleFilter, statusFilter]);

  const activeCount = members.filter((m) => m.status === "active").length;
  const inactiveCount = members.filter((m) => m.status === "inactive").length;

  const clearFilters = () => {
    setChapterFilter("");
    setCountryFilter("");
    setRoleFilter("");
    setStatusFilter("");
  };

  const hasFilters = chapterFilter || countryFilter || roleFilter || statusFilter;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">Manage everyone in your community.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/onboarding"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" /> Onboarding form
          </Link>
          <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90">
            <Plus className="h-4 w-4" /> Invite members
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or role…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-ring"
            />
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              showFilters || hasFilters
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {hasFilters && <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-bold text-primary-foreground">{[chapterFilter, countryFilter, roleFilter, statusFilter].filter(Boolean).length}</span>}
          </button>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-success">Active {activeCount}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">Inactive {inactiveCount}</span>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/20 px-4 py-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Chapter</label>
              <select
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
              >
                <option value="">All chapters</option>
                {chapters.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Country</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
              >
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mb-0.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Chapter</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">
                        {m.name.split(" ").map(p=>p[0]).join("").slice(0,2)}
                      </div>
                      <div>
                        <p className="font-semibold">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{m.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.chapter}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.country}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.joined}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      m.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><UserX className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No members match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 shadow-elegant">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl font-bold">Invite members</h3>
                <p className="mt-1 text-sm text-muted-foreground">Paste emails or upload a CSV. Each valid email receives an onboarding link.</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <textarea rows={5} placeholder="jane@example.com, john@example.com…" className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring" />
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background py-6 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="h-4 w-4" /> Upload a .csv or .txt file
                <input type="file" className="hidden" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowInvite(false)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
                <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  <Send className="h-3.5 w-3.5" /> Send invites
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
