import { Link } from "@tanstack/react-router";
import { Users2 } from "lucide-react";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-accent text-primary-foreground shadow-soft">
            <Users2 className="h-4 w-4" />
          </span>
          Kommunity
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/" activeOptions={{ exact: true }} className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Home</Link>
          <Link to="/about" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>About us</Link>
          <Link to="/pricing" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Pricing</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">Sign in</Link>
          <Link
            to="/signup"
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
        <p>© {new Date().getFullYear()} Kommunity. Built for communities.</p>
        <div className="flex gap-6">
          <Link to="/about" className="hover:text-foreground">About us</Link>
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/login" className="hover:text-foreground">Sign in</Link>
          <Link to="/signup" className="hover:text-foreground">Start trial</Link>
        </div>
      </div>
    </footer>
  );
}
