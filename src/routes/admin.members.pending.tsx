import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X, Clock, MapPin, Inbox } from "lucide-react";
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

function PendingApprovalsPage() {
  const submissions = usePendingMembers();
  const chapters = useChapters();
  const chapterById = (id?: string) => chapters.find((c) => c.id === id);

  const pending = submissions.filter((s) => s.status === "pending");
  const decided = submissions.filter((s) => s.status !== "pending");

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
          <Clock className="h-3 w-3" /> {pending.length} awaiting review
        </span>
      </header>

      <div className="space-y-3">
        {pending.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-lg font-semibold">No pending applications</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New submissions from your join link will appear here.
            </p>
          </div>
        )}
        {pending.map((s) => {
          const chapter = chapterById(s.chapterId);
          const name = s.data["Name"] ?? "(no name)";
          const email = s.data["Email"];
          const phone = s.data["Phone number"];
          return (
            <article key={s.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
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
                  .filter(([k]) => k !== "Chapter")
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
