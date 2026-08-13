import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Kommunity" },
      { name: "description", content: "The terms that govern your use of Kommunity." },
    ],
  }),
  component: TermsPage,
});

const EFFECTIVE = "13 August 2026";

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective {EFFECTIVE}</p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90">
          <P>
            These Terms of Service ("Terms") govern your access to and use of Kommunity (the "Service"), a
            community-management platform operated from Lagos, Nigeria ("Kommunity", "we", "us", or "our"). By
            creating an account, or by accessing or using the Service, you agree to these Terms. If you are
            agreeing on behalf of a community, association, estate, cooperative, or other organisation, you
            represent that you are authorised to bind that organisation to these Terms.
          </P>

          <Section n="1" title="Eligibility and accounts">
            <P>
              You must be at least 18 years old to create an administrator account. You are responsible for the
              accuracy of the information you provide, for keeping your login credentials confidential, and for all
              activity that occurs under your account. Notify us promptly at hello@akenrose.com if you suspect any
              unauthorised use.
            </P>
          </Section>

          <Section n="2" title="The Service">
            <P>
              Kommunity provides tools for managing a community, which may include a member directory, dues and
              donation collection, elections, broadcasts, birthday and reminder messaging, call-tree coordination,
              payouts, and related features. Features available to you depend on your subscription plan and may
              change over time. A "community admin" configures and manages a community; a "member" is a person who
              belongs to a community and holds a member account.
            </P>
          </Section>

          <Section n="3" title="Your community and member data">
            <P>
              As a community admin, you decide what member information to collect and upload, and you are the party
              responsible (the "data controller") for that information. You represent and warrant that you have a
              lawful basis to collect, upload, and process the personal data of your members — including obtaining
              any consent required under the Nigeria Data Protection Act 2023 (or the equivalent law of your
              jurisdiction) — and that you will use the Service in compliance with those laws. Kommunity processes
              member data on your behalf as described in our <Link to="/privacy" className="text-accent underline">Privacy Policy</Link>.
            </P>
          </Section>

          <Section n="4" title="Payments, fees, and billing">
            <P>
              <strong>Subscriptions and trials.</strong> Paid plans are billed in advance for the billing period you
              select (monthly or yearly). Free trials, where offered, convert to a paid plan only if you choose one;
              nothing is charged automatically at the end of a trial. Yearly plans are charged as stated at checkout.
            </P>
            <P>
              <strong>Dues and donations.</strong> Money your members pay through the Service (dues, donations, and
              similar) is collected through our payment processor, Paystack. We deduct a platform fee (shown to you
              before you collect) and, where applicable, the processor's own charges; the remainder is settled to
              your community, either directly to your bank account via Paystack split settlement or through the
              payout flow in the Service.
            </P>
            <P>
              <strong>SMS wallet.</strong> SMS is optional and prepaid. You top up an SMS wallet, and each message
              is charged against that balance at the provider's rate with no Kommunity mark-up. SMS credits are for
              use within the Service, are consumed as messages are sent, and are generally non-refundable except
              where required by law. Your SMS wallet is separate from your dues, donations, payouts, and
              subscription.
            </P>
            <P>
              <strong>Taxes.</strong> Fees are exclusive of any taxes, levies, or duties, which are your
              responsibility where applicable.
            </P>
          </Section>

          <Section n="5" title="Acceptable use">
            <P>You agree not to use the Service to:</P>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>break any applicable law, or infringe anyone's rights;</li>
              <li>send unsolicited, deceptive, or unlawful messages, or upload another person's data without a lawful basis;</li>
              <li>attempt to gain unauthorised access to the Service, other accounts, or our systems, or to disrupt or overload them;</li>
              <li>misrepresent your identity or your authority to act for a community; or</li>
              <li>use the Service to collect money fraudulently or for a purpose you have not disclosed to your members.</li>
            </ul>
          </Section>

          <Section n="6" title="Intellectual property">
            <P>
              The Service, including its software, design, and content we provide, belongs to Kommunity and its
              licensors. We grant you a limited, non-exclusive, non-transferable right to use the Service during
              your subscription. The data you and your members put into the Service remains yours; you grant us the
              limited rights needed to host and operate the Service for you.
            </P>
          </Section>

          <Section n="7" title="Third-party services">
            <P>
              The Service relies on third parties, including Paystack (payments), and email and SMS providers.
              Your use of those features may also be subject to the third party's terms. We are not responsible for
              third-party services, but we choose reputable providers and pass through only the data needed to
              deliver the feature.
            </P>
          </Section>

          <Section n="8" title="Availability and changes">
            <P>
              We work to keep the Service available and reliable but do not guarantee uninterrupted access. We may
              add, change, or remove features, and we may perform maintenance. Where a change materially reduces a
              paid feature, we will act reasonably and in good faith.
            </P>
          </Section>

          <Section n="9" title="Disclaimers">
            <P>
              The Service is provided "as is" and "as available". To the fullest extent permitted by law, we
              disclaim all warranties not expressly stated in these Terms, including implied warranties of
              merchantability, fitness for a particular purpose, and non-infringement. We are not a bank, a
              financial adviser, or a legal adviser, and nothing in the Service is financial or legal advice.
            </P>
          </Section>

          <Section n="10" title="Limitation of liability">
            <P>
              To the fullest extent permitted by law, Kommunity will not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our
              total liability arising out of or relating to the Service in any twelve-month period will not exceed
              the greater of the amounts you paid us for the Service in that period, or ₦50,000. Nothing in these
              Terms excludes liability that cannot be excluded under applicable law.
            </P>
          </Section>

          <Section n="11" title="Indemnity">
            <P>
              You agree to indemnify and hold Kommunity harmless from claims, losses, and expenses arising from your
              use of the Service in breach of these Terms or of applicable law, including any claim that your
              collection or use of member data was unlawful.
            </P>
          </Section>

          <Section n="12" title="Suspension and termination">
            <P>
              You may stop using the Service at any time. We may suspend or terminate access if you breach these
              Terms, if required by law, or to protect the Service or other users. On termination, your right to use
              the Service ends; we will make your data available for export for a reasonable period unless the law
              requires otherwise, after which it may be deleted.
            </P>
          </Section>

          <Section n="13" title="Governing law and disputes">
            <P>
              These Terms are governed by the laws of the Federal Republic of Nigeria. The parties will first try to
              resolve any dispute amicably; failing that, the dispute is subject to the exclusive jurisdiction of the
              courts of Lagos State, Nigeria. If you use the Service from another country, you are also responsible
              for complying with your local laws.
            </P>
          </Section>

          <Section n="14" title="Changes to these Terms">
            <P>
              We may update these Terms from time to time. If we make a material change, we will take reasonable
              steps to notify you (for example, by email or an in-app notice). Continuing to use the Service after a
              change takes effect means you accept the updated Terms.
            </P>
          </Section>

          <Section n="15" title="Contact">
            <P>
              Questions about these Terms? Email <a href="mailto:hello@akenrose.com" className="text-accent underline">hello@akenrose.com</a>,
              call +234 708 974 1989, or write to us in Lagos, Nigeria.
            </P>
          </Section>
        </div>
      </article>
      <MarketingFooter />
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold">{n}. {title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}
