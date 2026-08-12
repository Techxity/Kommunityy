import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, User, Banknote, Vote, Megaphone, Users2, LogOut, PhoneCall, ChevronsUpDown } from "lucide-react";
import { logout } from "@/lib/auth/auth.functions";
import { listMyCommunities, setMyActiveCommunity } from "@/lib/membership/members.functions";

// Only shown when the signed-in member belongs to more than one community —
// lets them switch which community the portal displays. Switching re-pins the
// session server-side, then reloads so every page re-reads the new community.
function CommunitySwitcher() {
  const [communities, setCommunities] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    listMyCommunities().then(setCommunities).catch(() => {});
  }, []);

  if (communities.length < 2) return null;
  const active = communities.find((c) => c.active) ?? communities[0];

  async function onChange(id: string) {
    if (switching || id === active.id) return;
    setSwitching(true);
    try {
      await setMyActiveCommunity({ data: { communityId: id } });
      window.location.assign("/member");
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className="relative">
      <select
        value={active.id}
        disabled={switching}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Switch community"
        className="appearance-none rounded-full border border-border bg-card py-1.5 pl-3 pr-8 text-xs font-semibold text-foreground outline-none hover:bg-muted focus:border-ring disabled:opacity-60"
      >
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };
const nav: NavItem[] = [
  { to: "/member", label: "Home", icon: Home, exact: true },
  { to: "/member/profile", label: "My Profile", icon: User },
  { to: "/member/dues", label: "My Dues", icon: Banknote },
  { to: "/member/elections", label: "Elections", icon: Vote },
  { to: "/member/calltree", label: "Call Tree", icon: PhoneCall },
  { to: "/member/updates", label: "Updates", icon: Megaphone },
];

export function MemberShell() {
  const location = useLocation();
  const navigate = useNavigate();

  async function handleSignOut() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/member" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-accent text-primary-foreground">
              <Users2 className="h-4 w-4" />
            </span>
            Kommunity
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <CommunitySwitcher />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {nav.map((item) => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
