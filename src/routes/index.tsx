import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import {
  ArrowRight,
  Cake,
  Megaphone,
  PhoneCall,
  Banknote,
  HeartHandshake,
  Vote,
  Users,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kommunity — Community Management for Associations & Estates" },
      { name: "description", content: "Memberships, dues, elections, broadcasts and care — all in one beautifully designed platform built for associations, alumni groups and estates." },
      { property: "og:title", content: "Kommunity — Run your community like an enterprise" },
      { property: "og:description", content: "From birthday wishes to digital elections — Kommunity gives your community admins the tools they need." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Users, title: "Membership Hub", body: "Onboard members with a custom form unique to your community. Edit, deactivate, segment." },
  { icon: Cake, title: "Birthday Magic", body: "Configure heartfelt messages by month. WhatsApp + email — automatic." },
  { icon: Megaphone, title: "Broadcasts", body: "Send templated announcements to every active member's inbox." },
  { icon: PhoneCall, title: "Call Tree Care", body: "Pair members, collect feedback, see who needs a follow-up." },
  { icon: Banknote, title: "Dues & Reminders", body: "Set frequency, currency, due dates. Automatic 3-2-1 day reminders." },
  { icon: HeartHandshake, title: "Donations", body: "Goal-based fundraising with live progress and member notifications." },
  { icon: Vote, title: "Digital Elections", body: "Year-bound cycles, scheduled start/end, live results on every dashboard." },
  { icon: ShieldCheck, title: "Subscription Tiers", body: "Basic, Premium, Enterprise — billed in USD or NGN via Stripe." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 pb-28 pt-24 md:pt-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs font-medium uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> Now in private beta
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Run your community<br />
            <span className="text-accent-foreground/90">like an enterprise.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-primary-foreground/75 md:text-xl">
            Kommunity is the operating system for associations, alumni networks, estates and fellowships.
            Membership, dues, elections and care — beautifully done.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-elegant transition hover:opacity-90"
            >
              Create your community <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10"
            >
              See pricing
            </Link>
          </div>

          {/* Hero bento preview */}
          <div className="mt-20 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { k: "Members", l: "Track everyone in one place" },
              { k: "Birthdays", l: "Automatic monthly messages" },
              { k: "Dues", l: "Collect in NGN or USD" },
              { k: "Elections", l: "Run a clean voting cycle" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-5 backdrop-blur">
                <p className="font-display text-3xl font-bold">{s.k}</p>
                <p className="mt-1 text-xs text-primary-foreground/70">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Everything you need</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            One platform. Every community ritual.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Designed around the things community admins actually do — from welcoming new members to running a clean election cycle.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-elegant"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-accent text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="overflow-hidden rounded-3xl bg-gradient-hero p-10 text-primary-foreground shadow-elegant md:p-16">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <h3 className="font-display text-3xl font-bold md:text-4xl">Start with a 14-day Enterprise trial.</h3>
              <p className="mt-3 text-primary-foreground/75">
                No credit card. Every feature unlocked. Subscribe when you're ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft hover:opacity-90">
                Start trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-semibold">
                View plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
