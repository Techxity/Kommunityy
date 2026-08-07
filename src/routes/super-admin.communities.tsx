import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, MoreHorizontal, Filter, Eye, Power, X } from "lucide-react";
import { listCommunitiesForSuperAdmin, setCommunitySuspended } from "@/lib/payments/super-admin-communities.functions";

export const Route = createFileRoute("/super-admin/communities")({
  head: () => ({ meta: [{ title: "Communities — Super Admin" }] }),
  component: Communities,
});

type Community = Awaited<ReturnType<typeof listCommunitiesForSuperAdmin>>[number];

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-700",
  Trial: "bg-blue-500/10 text-blue-700",
  "Trial ended": "bg-amber-500/10 text-amber-700",
  Suspended: "bg-rose-500/10 text-rose-700",
};

function Communities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Community | null>(null);

  function refresh() {
    listCommunitiesForSuperAdmin().then(setCommunities).catch(() => setCommunities([]));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleSuspended(c: Community) {
    await setCommunitySuspended({ data: { id: c.id, suspended: !c.suspended } });
    setMenuFor(null);
    refresh();
  }

  const filtered = communities.filter((c) => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase());
    const matchS = status === "All" || c.status === status;
    return matchQ && matchS;
  });

  return (
    <div className="space-y-6" onClick={() => setMenuFor(null)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Communities</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every workspace on Kinfolk — {communities.length} total.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full rounded-full border border-border bg-card pl-10 pr-4 py-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["All", "Active", "Trial", "Trial ended", "Suspended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-visible rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Community</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-left">Plan</th>
              <th className="px-5 py-3 text-right">Members</th>
              <th className="px-5 py-3 text-right">MRR</th>
              <th className="px-5 py-3 text-left">Joined</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className={`border-t border-border hover:bg-muted/30 ${c.suspended ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  <p className="font-semibold">
                    {c.name}
                    {c.suspended && (
                      <span className="ml-2 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                        Suspended
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.id} · {c.ownerEmail}</p>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{c.type}</td>
                <td className="px-5 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.plan}</span></td>
                <td className="px-5 py-3 text-right tabular-nums">{c.members.toLocaleString()}</td>
                <td className="px-5 py-3 text-right tabular-nums">{c.mrrNgn > 0 ? `₦${c.mrrNgn.toLocaleString()}` : "—"}</td>
                <td className="px-5 py-3 text-muted-foreground">{c.joined}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[c.status] ?? "bg-muted"}`}>{c.status}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuFor((m) => (m === c.id ? null : c.id));
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuFor === c.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
                      >
                        <button
                          onClick={() => {
                            setViewing(c);
                            setMenuFor(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Eye className="h-4 w-4" /> View details
                        </button>
                        <button
                          onClick={() => toggleSuspended(c)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                            c.suspended ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          <Power className="h-4 w-4" /> {c.suspended ? "Re-enable community" : "Suspend community"}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {communities.length === 0 ? "No communities have signed up yet." : "No communities match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && <CommunityDetails community={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function CommunityDetails({ community, onClose }: { community: Community; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{community.id}</p>
            <p className="font-display text-xl font-bold">{community.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{community.type}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Detail label="Owner" value={community.ownerName} />
          <Detail label="Owner email" value={community.ownerEmail} />
          <Detail label="Plan" value={community.plan} />
          <Detail label="MRR" value={community.mrrNgn > 0 ? `₦${community.mrrNgn.toLocaleString()}` : "—"} />
          <Detail label="Active members" value={community.members.toLocaleString()} />
          <Detail label="Status" value={community.status} />
          <Detail label="Trial ends" value={community.trialEndsAt ?? "—"} />
          <Detail label="Joined" value={community.joined} />
        </div>

        {community.suspended && (
          <p className="mt-5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
            Members and the admin of this community can't sign in, and new join applications are rejected, until you re-enable it.
          </p>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
