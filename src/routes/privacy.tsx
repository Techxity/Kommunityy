import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Kommunity" },
      { name: "description", content: "How Kommunity collects, uses, and protects personal data." },
    ],
  }),
  component: PrivacyPage,
});

const EFFECTIVE = "13 August 2026";

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective {EFFECTIVE}</p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90">
          <P>
            This Privacy Policy explains how Kommunity ("we", "us", or "our") collects, uses, shares, and protects
            personal data when you use our community-management platform (the "Service"). We are committed to
            handling personal data in line with the Nigeria Data Protection Act 2023 (the "NDPA") and the Nigeria
            Data Protection Regulation, and with applicable data protection laws in the other African countries where
            our users operate.
          </P>

          <Section n="1" title="Controller and processor roles">
            <P>
              For data about our direct customers and website visitors (for example, community administrators who
              sign up), Kommunity is the data controller. For personal data that a community uploads about its own
              members, the community (through its admins) is the data controller and Kommunity acts as a data
              processor, handling that data only to provide the Service and on the community's instructions.
            </P>
          </Section>

          <Section n="2" title="Contact">
            <P>
              For any privacy question or to exercise your rights, contact us at
              <a href="mailto:hello@akenrose.com" className="text-accent underline"> hello@akenrose.com</a>, call
              +234 708 974 1989, or write to us in Lagos, Nigeria. If you are a member of a community, you can also
              contact your community's admin, who controls your data on the Service.
            </P>
          </Section>

          <Section n="3" title="Data we collect">
            <ul className="ml-5 list-disc space-y-1.5">
              <li><strong>Account data:</strong> name, email address, phone number, password (stored only as a secure hash), and role.</li>
              <li><strong>Member data (on behalf of communities):</strong> names, contact details, dates of birth, addresses, chapter or group, membership status, and similar details a community chooses to record.</li>
              <li><strong>Payment data:</strong> records of dues, donations, and top-ups — amounts, dates, and references. Card and bank credentials are collected and processed directly by Paystack; we do not store full card numbers.</li>
              <li><strong>Communications:</strong> emails and SMS we send on your or your community's behalf, and messages you send us.</li>
              <li><strong>Usage and device data:</strong> log data such as IP address, actions taken, and timestamps, used to run and secure the Service.</li>
            </ul>
          </Section>

          <Section n="4" title="How we use data and our lawful basis">
            <P>Under the NDPA, we rely on one or more of these lawful bases:</P>
            <ul className="ml-5 list-disc space-y-1.5">
              <li><strong>Performance of a contract</strong> — to provide the Service to you and your community.</li>
              <li><strong>Consent</strong> — where you or a community member has given consent (for example, to receive certain messages); consent can be withdrawn at any time.</li>
              <li><strong>Legitimate interests</strong> — to secure, maintain, and improve the Service, and to prevent fraud and abuse, balanced against your rights.</li>
              <li><strong>Legal obligation</strong> — to meet requirements under applicable law.</li>
            </ul>
          </Section>

          <Section n="5" title="Sharing and service providers">
            <P>
              We do not sell personal data. We share it only with service providers who help us run the Service,
              under contracts that require them to protect it and use it only as instructed. These include:
            </P>
            <ul className="ml-5 list-disc space-y-1.5">
              <li><strong>Paystack</strong> — to process payments and settlements;</li>
              <li><strong>Our email provider</strong> — to deliver transactional and community emails;</li>
              <li><strong>Our SMS provider</strong> — to deliver text messages when SMS is enabled;</li>
              <li><strong>Our hosting and database providers</strong> — to store and run the Service securely.</li>
            </ul>
            <P>We may also disclose data where required by law, to enforce our Terms, or to protect the rights and safety of users and the public.</P>
          </Section>

          <Section n="6" title="International transfers">
            <P>
              Some of our providers process data outside your country. Where personal data is transferred across
              borders, we take steps required by the NDPA and applicable law to ensure it remains adequately
              protected, such as relying on adequacy, appropriate contractual safeguards, or your consent.
            </P>
          </Section>

          <Section n="7" title="Data retention">
            <P>
              We keep personal data for as long as needed to provide the Service and for a reasonable period
              afterwards, or longer where the law requires (for example, financial records). Communities can update
              or delete member records, and you can ask us to delete your account data, subject to legal retention
              requirements.
            </P>
          </Section>

          <Section n="8" title="Security">
            <P>
              We use technical and organisational measures to protect personal data, including encryption in
              transit, hashed passwords, access controls, and least-privilege handling of sensitive data such as
              bank details. No system is perfectly secure, but we work continuously to protect your information.
            </P>
          </Section>

          <Section n="9" title="Your rights">
            <P>Subject to the NDPA and applicable law, you have the right to:</P>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>access the personal data we hold about you;</li>
              <li>have inaccurate data corrected;</li>
              <li>request deletion of your data;</li>
              <li>object to or restrict certain processing;</li>
              <li>withdraw consent where processing is based on consent;</li>
              <li>request a portable copy of data you provided; and</li>
              <li>lodge a complaint with a supervisory authority (see below).</li>
            </ul>
            <P>
              If you are a community member, requests about your membership data are usually best directed to your
              community's admin (the controller); we will assist them as processor.
            </P>
          </Section>

          <Section n="10" title="Children's data">
            <P>
              Administrator accounts are for adults (18+). Some communities may record data about members who are
              minors. Where they do, the community is responsible for obtaining any consent required from a parent or
              guardian under the NDPA and applicable law. We do not knowingly use children's data for any purpose
              beyond providing the Service to the community.
            </P>
          </Section>

          <Section n="11" title="Cookies and similar technologies">
            <P>
              We use only the cookies and local storage needed to sign you in and keep the Service working (for
              example, to maintain your session). We do not use third-party advertising cookies.
            </P>
          </Section>

          <Section n="12" title="Data breaches">
            <P>
              If a personal data breach occurs that is likely to result in harm, we will act promptly to contain it
              and will notify the relevant supervisory authority and affected people as required by the NDPA and
              applicable law.
            </P>
          </Section>

          <Section n="13" title="Complaints">
            <P>
              If you have a concern we have not resolved, you may complain to the Nigeria Data Protection Commission
              (NDPC), or to the data protection authority in your own country. We would appreciate the chance to
              address your concern first — please contact us at hello@akenrose.com.
            </P>
          </Section>

          <Section n="14" title="Changes to this policy">
            <P>
              We may update this Policy from time to time. We will post the updated version here with a new effective
              date and, for material changes, take reasonable steps to notify you.
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
