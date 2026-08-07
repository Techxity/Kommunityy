import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { logout } from "@/lib/auth/auth.functions";
import { getMyCommunity } from "@/lib/payments/communities.functions";
import { getMyModules } from "@/lib/payments/tiers.functions";
import {
  LayoutDashboard,
  Users,
  Cake,
  Megaphone,
  PhoneCall,
  Banknote,
  HeartHandshake,
  Vote,
  CreditCard,
  Settings2,
  Bell,
  LogOut,
  Users2,
  ChevronDown,
  Lock,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// `module`, when set, ties a nav entry to a plan module (see
// src/lib/module-gate.ts) — the item still shows, but locked/disabled with
// a tooltip, if the community's current plan doesn't include it.
type SubItem = { to: string; label: string; module?: string };
type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  to?: string;
  module?: string;
  children?: SubItem[];
};

const nav: NavGroup[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    label: "Member Management",
    icon: Users,
    children: [
      { to: "/admin/members", label: "Members", module: "Membership" },
      { to: "/admin/chapters", label: "Chapters", module: "Membership" },
      { to: "/admin/calltree", label: "Call Tree", module: "Call Tree" },
      { to: "/admin/birthdays", label: "Birthdays", module: "Birthdays" },
    ],
  },
  {
    label: "Funds Management",
    icon: Banknote,
    children: [
      { to: "/admin/dues", label: "Dues", module: "Dues" },
      { to: "/admin/donations", label: "Donations", module: "Donations" },
      { to: "/admin/payouts", label: "Payouts" },
    ],
  },
  { to: "/admin/elections", label: "Elections", icon: Vote, module: "Elections" },
  { to: "/admin/broadcast", label: "Broadcasts", icon: Megaphone, module: "Broadcasts" },
  { to: "/admin/subscription", label: "Subscription", icon: CreditCard },
  { to: "/admin/settings", label: "Settings", icon: Settings2 },
];

function isActive(path: string, exact?: boolean, locationPathname?: string) {
  if (!locationPathname) return false;
  return exact ? locationPathname === path : locationPathname === path || locationPathname.startsWith(path + "/");
}

function LockedItem({ label, indent }: { label: string; indent?: boolean }) {
  return (
    <Link
      to="/admin/subscription"
      title={`${label} isn't included in your current plan — upgrade to unlock it.`}
      className={`flex items-center gap-2 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground/60 ${
        indent ? "px-3 py-1.5 text-sm" : "px-3 py-2 text-sm font-medium"
      }`}
    >
      <Lock className="h-3 w-3 shrink-0" />
      {label}
    </Link>
  );
}

function GroupItem({
  group,
  pathname,
  modules,
}: {
  group: NavGroup;
  pathname: string;
  modules: string[] | null;
}) {
  const [open, setOpen] = useState(() =>
    group.children ? group.children.some((c) => isActive(c.to, false, pathname)) : false
  );

  // Until modules have loaded, don't lock anything (avoids a flash of
  // locked items on every page load).
  const locked = (m?: string) => !!m && !!modules && !modules.includes(m);

  if (group.to) {
    if (locked(group.module)) return <LockedItem label={group.label} />;
    const Icon = group.icon;
    const active = isActive(group.to, group.exact, pathname);
    return (
      <Link
        to={group.to}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {group.label}
      </Link>
    );
  }

  const Icon = group.icon;
  const anyChildActive = group.children?.some((c) => isActive(c.to, false, pathname)) ?? false;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
            anyChildActive
              ? "bg-sidebar-accent/40 text-sidebar-accent-foreground"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          }`}
        >
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4" />
            {group.label}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-sidebar-foreground/50 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
          {group.children?.map((child) => {
            if (locked(child.module)) return <LockedItem key={child.to} label={child.label} indent />;
            const childActive = isActive(child.to, false, pathname);
            return (
              <Link
                key={child.to}
                to={child.to}
                className={`block rounded-md px-3 py-1.5 text-sm transition ${
                  childActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AdminShell() {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const [community, setCommunity] = useState<{ id: string; name: string; trialDaysLeft: number; onTrial: boolean; tierName: string | null } | null>(null);
  const [modules, setModules] = useState<string[] | null>(null);

  useEffect(() => {
    getMyCommunity().then(setCommunity).catch(() => setCommunity(null));
    getMyModules().then(setModules).catch(() => setModules([]));
  }, []);

  async function handleSignOut() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-accent text-primary-foreground">
            <Users2 className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-none">Kinfolk</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Admin Console</p>
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="rounded-xl bg-sidebar-accent/60 p-3">
            <p className="text-xs text-sidebar-foreground/60">Community</p>
            <p className="mt-0.5 truncate text-sm font-semibold">{community?.name || "—"}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-sidebar-foreground/60">
                {community?.onTrial ? `Trial: ${community.trialDaysLeft}d left` : community?.tierName ? `${community.tierName} plan` : ""}
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {nav.map((group) => (
            <GroupItem key={group.label} group={group} pathname={pathname} modules={modules} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
            <p className="font-display text-lg font-semibold">{community?.name || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">A</div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-none">Admin</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Community Admin</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

