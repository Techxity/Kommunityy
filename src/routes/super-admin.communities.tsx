import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MoreHorizontal, Plus, Filter, Eye, Power, X } from "lucide-react";
import { useCommunities, communitiesStore, type Community } from "@/lib/communities-store";

export const Route = createFileRoute("/super-admin/communities")({
  head: () => ({ meta: [{ title: "Communities — Super Admin" }] }),
  component: Communities,
});

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-700",
  Trial: "bg-blue-500/10 text-blue-700",
  "Past Due": "bg-amber-500/10 text-amber-700",
  Suspended: "bg-rose-500/10 text-rose-700",
};

function Communities() {
  const communities = useCommunities();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Community | null>(null);

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
          <p className="mt-1 text-sm text-muted-foreground">Every workspace on Kinfolk, across {new Set(communities.map((c) => c.country)).size} countries.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Provision community
        </button>
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
          {(["All", "Active", "Trial", "Past Due", "Suspended"] as const).map((s) => (
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
              <th className="px-5 py-3 text-left">Country</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className={`border-t border-border hover:bg-muted/30 ${c.disabled ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  <p className="font-semibold">
                    {c.name}
                    {c.disabled && (
                      <span className="ml-2 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                        Disabled
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.id} · {c.owner}</p>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{c.type}</td>
                <td className="px-5 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.plan}</span></td>
                <td className="px-5 py-3 text-right tabular-nums">{c.members.toLocaleString()}</td>
                <td className="px-5 py-3 text-right tabular-nums">${c.mrr}</td>
                <td className="px-5 py-3 text-muted-foreground">{c.country}</td>
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
                          onClick={() => {
                            communitiesStore.setDisabled(c.id, !c.disabled);
                            setMenuFor(null);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                            c.disabled ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          <Power className="h-4 w-4" /> {c.disabled ? "Enable community" : "Disable community"}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && <CommunityDetails community={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function CommunityDetails({ community, onClose }: { community: Community; onClose: () => void }) {
  const o = community.onboarding;
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
            <p className="mt-1 text-sm text-muted-foreground">{community.type} · {community.country}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Detail label="Owner" value={community.owner} />
          <Detail label="Plan" value={community.plan} />
          <Detail label="Members" value={community.members.toLocaleString()} />
          <Detail label="MRR" value={`$${community.mrr}`} />
          <Detail label="Status" value={community.status} />
          <Detail label="Joined" value={community.joined} />
          <Detail label="Access" value={community.disabled ? "Disabled" : "Active"} />
        </div>

        {community.disabled && (
          <p className="mt-5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
            Members of this community can't sign in or submit join applications until you re-enable it.
          </p>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-bold uppercase tracking-wider">Onboarding submission</p>
            {o && (
              <span className="text-[11px] text-muted-foreground">Submitted {o.submittedAt}</span>
            )}
          </div>
          {o ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Contact name" value={o.contactName} />
                <Detail label="Role" value={o.contactRole} />
                <Detail label="Contact email" value={o.contactEmail} />
                <Detail label="Phone" value={o.contactPhone} />
                <Detail label="Founded" value={String(o.foundedYear)} />
                <Detail label="Expected members" value={o.expectedMembers.toLocaleString()} />
                <Detail label="Collects dues" value={o.collectsDues} />
                <Detail label="Payment provider" value={o.paymentProvider} />
                {o.website && <Detail label="Website" value={o.website} />}
                <Detail label="Terms accepted" value={o.agreedToTerms ? "Yes" : "No"} />
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Primary goal</p>
                <p className="mt-1 text-sm">{o.primaryGoal}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Address</p>
                <p className="mt-1 text-sm">{o.address}</p>
              </div>
              {o.notes && (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes from applicant</p>
                  <p className="mt-1 text-sm">{o.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              No onboarding submission on file for this community.
            </p>
          )}
        </div>
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
