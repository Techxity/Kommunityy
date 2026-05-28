import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { ArrowLeft, Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Kinfolk" },
      { name: "description", content: "Learn about Kinfolk and get in touch with our team." },
      { property: "og:title", content: "About Us — Kinfolk" },
      { property: "og:description", content: "Learn about Kinfolk and get in touch with our team." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* About Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">About Kinfolk</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Kinfolk is the operating system for associations, alumni networks, estates and fellowships.
          We believe every community deserves enterprise-grade tools without the enterprise complexity.
        </p>
      </section>

      {/* Mission / Values */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: "Built for Admins", body: "We design every feature around the real workflows of community administrators — not abstract dashboards." },
            { title: "Privacy First", body: "Your member data belongs to your community. We never sell or share data with third parties." },
            { title: "Fair Pricing", body: "Start free. Upgrade when you grow. No hidden fees, no long-term contracts." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h3 className="font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-10 md:grid-cols-2">
          {/* Contact Info */}
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Contact Us</h2>
            <p className="mt-3 text-muted-foreground">
              Have questions about Kinfolk? Want to schedule a demo? We'd love to hear from you.
            </p>
            <div className="mt-8 space-y-5">
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">hello@kinfolk.app</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Phone</p>
                  <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Address</p>
                  <p className="text-sm text-muted-foreground">San Francisco, CA</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            {sent ? (
              <div className="text-center py-10">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
                  <Send className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold">Message sent!</h3>
                <p className="mt-2 text-sm text-muted-foreground">We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground">Full Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input mt-1.5"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Email *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input mt-1.5"
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Message *</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="input mt-1.5 resize-y"
                    placeholder="How can we help you?"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
                >
                  Send message <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
