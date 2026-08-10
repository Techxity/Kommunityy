import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { logout } from "@/lib/auth/auth.functions";
import {
  LayoutDashboard,
  ShieldCheck,
  LifeBuoy,
  ScrollText,
  Bell,
  LogOut,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Wallet,
  Users,
} from "lucide-react";
import { useState } from "react";

type SubItem = { to: string; label: string };

type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  items: SubItem[];
};

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const nav: NavEntry[] = [
  { to: "/super-admin", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    label: "Community Management",
    icon: Users,
    items: [
      { to: "/super-admin/communities", label: "Communities" },
      { to: "/super-admin/plans", label: "Plans & Modules" },
    ],
  },
  {
    label: "Payment Management",
    icon: Wallet,
    items: [
      { to: "/super-admin/fees", label: "Platform Fees" },
      { to: "/super-admin/payouts", label: "Payouts" },
      { to: "/super-admin/billing", label: "Billing & Revenue" },
    ],
  },
  { to: "/super-admin/admins", label: "Platform Admins", icon: ShieldCheck },
  { to: "/super-admin/support", label: "Support", icon: LifeBuoy },
  { to: "/super-admin/audit", label: "Audit Log", icon: ScrollText },
];

function NavList() {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Community Management": true,
    "Payment Management": true,
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isItemActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(to + "/");
  };

  return (
    <>
      {nav.map((entry) => {
        if (isGroup(entry)) {
          const GroupIcon = entry.icon;
          const isOpen = openGroups[entry.label] ?? false;
          const hasActiveChild = entry.items.some((sub) => isItemActive(sub.to));
          return (
            <div key={entry.label} className="mb-1">
              <button
                onClick={() => toggleGroup(entry.label)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  hasActiveChild
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <GroupIcon className="h-4 w-4" />
                <span className="flex-1 text-left">{entry.label}</span>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                )}
              </button>
              {isOpen && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                  {entry.items.map((sub) => {
                    const active = isItemActive(sub.to);
                    return (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const Icon = entry.icon;
        const active = isItemActive(entry.to, entry.exact);
        return (
          <Link
            key={entry.to}
            to={entry.to}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {entry.label}
          </Link>
        );
      })}
    </>
  );
}

export function SuperAdminShell() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-none">Kommunity</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Platform Control</p>
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 p-3">
            <p className="text-xs text-sidebar-foreground/60">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold">Super Admin</p>
            <span className="mt-2 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
              Super Admin
            </span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          <NavList />
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
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Platform</p>
            <p className="font-display text-lg font-semibold">Kommunity Control Center</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-accent to-primary text-xs font-bold text-primary-foreground">SA</div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-none">Super Admin</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Super Admin</p>
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
