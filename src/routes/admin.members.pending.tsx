import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X, Clock, MapPin, Inbox, CheckSquare, Square, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listMembers, setMembersStatus } from "@/lib/membership/members.functions";
import { listMyChapters } from "@/lib/membership/chapters.functions";

export const Route = createFileRoute("/admin/members/pending")({
  component: PendingApprovalsPage,
});

type Member = Awaited<ReturnType<typeof listMembers>>[number];

function timeAgo(iso: string) {
  if (!iso) return "recently";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PendingApprovalsPage() {
  const [pending, setPending] = useState<Member[]>([]);
  const [decided, setDecided] = useState<Member[]>([]);
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);

  const [showFilters, setShowFilters] = useState(false);
  const [chapterFilter, setChapterFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function refresh() {
    listMembers({ data: { status: "pending" } }).then(setPending);
    listMembers({ data: { status: "rejected" } }).then(setDecided);
  }

  useEffect(() => {
    refresh();
    listMyChapters().then((rows) => setChapters(rows.map((c) => ({ id: c.id, name: c.name }))));
  }, []);

  const filteredPending = useMemo(() => {
    return pending.filter((s) => !chapterFilter || s.chapterId === chapterFilter);
  }, [pending, chapterFilter]);

  const chapterOptions = chapters;
  const hasFilters = !!chapterFilter;
  const clearFilters = () => setChapterFilter("");

  const allSelected = filteredPending.length > 0 && selected.size === filteredPending.length;
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filteredPending.map((s) => s.id)));

  async function decide(ids: string[], status: "active" | "rejected") {
    if (ids.length === 0) return;
    await setMembersStatus({ data: { ids, status } });
    setSelected(new Set());
    refresh();
  }

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

      {chapterOptions.length > 0 && (
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
            {hasFilters && <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-bold text-primary-foreground">1</span>}
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
      )}

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
        </div>
      )}

      {filteredPending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-primary bg-primary/5 px-5 py-4 shadow-soft">
          <label className="inline-flex cursor-pointer items-center gap-3 text-base font-bold text-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-5 w-5 cursor-pointer accent-primary"
            />
            <span>{allSelected ? "Deselect all" : `Select all ${filteredPending.length}`}</span>
            {selected.size > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {selected.size} selected
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <button
              disabled={selected.size === 0}
              onClick={() => decide(Array.from(selected), "rejected")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground"
            >
              <X className="h-3 w-3" /> Reject selected
            </button>
            <button
              disabled={selected.size === 0}
              onClick={() => decide(Array.from(selected), "active")}
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
          const checked = selected.has(s.id);
          const initials = s.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
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
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.email}
                      {s.phone && <> · {s.phone}</>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(s.joined)}
                      </span>
                      {s.chapter && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          <MapPin className="h-3 w-3" /> {s.chapter}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => decide([s.id], "rejected")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                  <button
                    onClick={() => decide([s.id], "active")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                </div>
              </div>

              {(s.whatsapp || s.dob || s.address || Object.keys(s.extra ?? {}).length > 0) && (
                <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-4 text-xs sm:grid-cols-2">
                  {s.whatsapp && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">WhatsApp Number</dt>
                      <dd className="font-medium text-right">{s.whatsapp}</dd>
                    </div>
                  )}
                  {s.dob && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Date of Birth</dt>
                      <dd className="font-medium text-right">{s.dob}</dd>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Address</dt>
                      <dd className="font-medium text-right">{s.address}</dd>
                    </div>
                  )}
                  {Object.entries(s.extra ?? {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium text-right">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          );
        })}
      </div>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recently rejected
          </h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {decided.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground"> · {s.email}</span>
                </span>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  rejected
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
