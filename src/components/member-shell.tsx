import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Home, User, Banknote, Vote, Megaphone, Users2, LogOut } from "lucide-react";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };
const nav: NavItem[] = [
  { to: "/member", label: "Home", icon: Home, exact: true },
  { to: "/member/profile", label: "My Profile", icon: User },
  { to: "/member/dues", label: "My Dues", icon: Banknote },
  { to: "/member/elections", label: "Elections", icon: Vote },
  { to: "/member/updates", label: "Updates", icon: Megaphone },
];

export function MemberShell() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/member" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-accent text-primary-foreground">
              <Users2 className="h-4 w-4" />
            </span>
            Kinfolk
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
          <Link to="/login" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Link>
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
