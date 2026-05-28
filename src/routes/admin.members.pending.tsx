import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X, Clock, MapPin, Inbox, CheckSquare, Square, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { pendingMembersStore, usePendingMembers } from "@/lib/pending-members-store";
import { useChapters } from "@/lib/chapters-store";

export const Route = createFileRoute("/admin/members/pending")({
  component: PendingApprovalsPage,
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getCountryFromChapterRegion(region?: string): string {
  if (!region) return "";
  const parts = region.split(",");
  return parts.length > 1 ? parts[parts.length - 1].trim() : region.trim();
}

function PendingApprovalsPage() {
  const submissions = usePendingMembers();
  const chapters = useChapters();
  const chapterById = (id?: string) => chapters.find((c) => c.id === id);

  const [showFilters, setShowFilters] = useState(false);
  const [chapterFilter, setChapterFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const allPending = useMemo(() => submissions.filter((s) => s.status === "pending"), [submissions]);
  const decided = submissions.filter((s) => s.status !== "pending");

  const filteredPending = useMemo(() => {
    return allPending.filter((s) => {
      const chapter = chapterById(s.chapterId);
      const country = s.data["Country"] || getCountryFromChapterRegion(chapter?.region);
      const role = s.data["Role"] || "";
      const matchesChapter = !chapterFilter || s.chapterId === chapterFilter;
      const matchesCountry = !countryFilter || country === countryFilter;
      const matchesRole = !roleFilter || role === roleFilter;
      return matchesChapter && matchesCountry && matchesRole;
    });
  }, [allPending, chapterFilter, countryFilter, roleFilter, chapters]);

  const chapterOptions = useMemo(() => chapters.map((c) => ({ id: c.id, name: c.name })), [chapters]);
  const countryOptions = useMemo(
    () => Array.from(new Set(allPending.map((s) => {
      const ch = chapterById(s.chapterId);
      return s.data["Country"] || getCountryFromChapterRegion(ch?.region);
    }).filter(Boolean))),
    [allPending, chapters]
  );
  const roleOptions = useMemo(
    () => Array.from(new Set(allPending.map((s) => s.data["Role"]).filter(Boolean))),
    [allPending]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = filteredPending.length > 0 && selected.size === filteredPending.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filteredPending.map((s) => s.id)));
  };
  const bulkSet = (status: "approved" | "rejected") => {
    selected.forEach((id) => pendingMembersStore.setStatus(id, status));
    setSelected(new Set());
  };

  const hasFilters = chapterFilter || countryFilter || roleFilter;
  const clearFilters = () => {
    setChapterFilter("");
    setCountryFilter("");
    setRoleFilter("");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Member Management</p>
          <h1 className="font-display text-3xl font-bold">Pending approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submissions from your{" "}
            <Link to="/admin/onboarding" className="font-semibold text-primary hover:underline">public join form</Link>.
            Approve to add them to your members list.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
          <Clock className="h-3 w-3" /> {filteredPending.length} awaiting review
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            showFilters || hasFilters
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {hasFilters && <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-bold text-primary-foreground">{[chapterFilter, countryFilter, roleFilter].filter(Boolean).length}</span>}
        </button>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Chapter</label>
            <select
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
            >
              <option value="">All chapters</option>
              {chapterOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
              {countryOptions.map((c) => (
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
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {filteredPending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-soft">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
            {allSelected ? "Deselect all" : "Select all"}
            {selected.size > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {selected.size}
              </span>
            )}
          </button>
          <div className="flex gap-2">
            <button
              disabled={selected.size === 0}
              onClick={() => bulkSet("rejected")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <X className="h-3 w-3" /> Reject selected
            </button>
            <button
              disabled={selected.size === 0}
              onClick={() => bulkSet("approved")}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-40"
            >
              <Check className="h-3 w-3" /> Approve selected
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredPending.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-lg font-semibold">No pending applications</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters ? "No applications match your filters." : "New submissions from your join link will appear here."}
            </p>
          </div>
        )}
        {filteredPending.map((s) => {
          const chapter = chapterById(s.chapterId);
          const country = s.data["Country"] || getCountryFromChapterRegion(chapter?.region);
          const role = s.data["Role"] || "";
          const name = s.data["Name"] ?? "(no name)";
          const email = s.data["Email"];
          const phone = s.data["Phone number"];
          const checked = selected.has(s.id);
          return (
            <article
              key={s.id}
              className={`rounded-2xl border bg-card p-5 shadow-soft transition ${
                checked ? "border-primary ring-1 ring-primary/30" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggle(s.id)}
                    className="mt-1 rounded p-0.5 hover:bg-muted"
                    aria-label="Select application"
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-sm font-bold text-primary-foreground">
                    {name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {email}
                      {phone && <> · {phone}</>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(s.submittedAt)}
                      </span>
                      {chapter && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          <MapPin className="h-3 w-3" /> {chapter.name}
                        </span>
                      )}
                      {country && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          {country}
                        </span>
                      )}
                      {role && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          {role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => pendingMembersStore.setStatus(s.id, "rejected")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                  <button
                    onClick={() => pendingMembersStore.setStatus(s.id, "approved")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-4 text-xs sm:grid-cols-2">
                {Object.entries(s.data)
                  .filter(([k]) => k !== "Chapter" && k !== "Country" && k !== "Role")
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium text-right">{v || "—"}</dd>
                    </div>
                  ))}
              </dl>
            </article>
          );
        })}
      </div>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recently reviewed
          </h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {decided.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{s.data["Name"]}</span>
                  <span className="text-muted-foreground"> · {s.data["Email"]}</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    s.status === "approved"
                      ? "bg-success/15 text-success"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
