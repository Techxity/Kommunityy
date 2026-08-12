import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { listMyWorkspaces, setActiveWorkspace } from "@/lib/membership/members.functions";

type Workspace = Awaited<ReturnType<typeof listMyWorkspaces>>[number];

// Unified switcher shown in every console. Lists every community the account
// administers (Admin), is an active member of (Member), plus the platform
// console for super admins. Selecting one pins that community server-side and
// jumps to the right console. Hidden when there's only one workspace.
//
// `current` is which console it's rendered in, so the dropdown shows the right
// entry as selected even when the session pin and the console differ.
export function WorkspaceSwitcher({ current }: { current: "admin" | "member" | "super" }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listMyWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  if (workspaces.length < 2) return null;

  const keyFor = (w: Workspace) => `${w.role}:${w.communityId ?? "platform"}`;
  const selected =
    (current === "super"
      ? workspaces.find((w) => w.role === "super")
      : workspaces.find((w) => w.role === current && w.active) ?? workspaces.find((w) => w.role === current)) ??
    workspaces[0];

  async function onSelect(key: string) {
    const w = workspaces.find((x) => keyFor(x) === key);
    if (!w || busy || keyFor(w) === keyFor(selected)) return;
    setBusy(true);
    try {
      if (w.role === "super") {
        window.location.assign("/super-admin");
        return;
      }
      await setActiveWorkspace({ data: { communityId: w.communityId as string } });
      window.location.assign(w.role === "admin" ? "/admin" : "/member");
    } catch {
      setBusy(false);
    }
  }

  const roleLabel = (r: Workspace["role"]) => (r === "admin" ? "Admin" : r === "member" ? "Member" : "Platform");

  return (
    <div className="relative">
      <select
        value={keyFor(selected)}
        disabled={busy}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Switch workspace"
        className="appearance-none rounded-full border border-border bg-card py-1.5 pl-3 pr-8 text-xs font-semibold text-foreground outline-none hover:bg-muted focus:border-ring disabled:opacity-60"
      >
        {workspaces.map((w) => (
          <option key={keyFor(w)} value={keyFor(w)}>
            {w.role === "super" ? w.name : `${w.name} · ${roleLabel(w.role)}`}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
