import type { Metadata } from "next";
import { LegalDoc, LegalNote } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Crew collects, holds, uses and discloses your personal information, and your rights under the Australian Privacy Act 1988.",
};

// DRAFT: requires legal review before launch
export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro="How we collect, hold, use and disclose your personal information, and your rights under Australian privacy law."
      effective="7 May 2026"
      updated="7 May 2026"
      toc={[
        { href: "#about", label: "About This Policy and Who We Are" },
        { href: "#what-we-collect", label: "What Personal Information We Collect" },
        { href: "#how-we-collect", label: "How We Collect Personal Information" },
        { href: "#use", label: "Why We Collect It and How We Use It" },
        { href: "#disclosure", label: "Disclosure to Third Parties" },
        { href: "#overseas", label: "Overseas Disclosure of Personal Information (APP 8)" },
        { href: "#cookies", label: "Cookies and Analytics" },
        { href: "#marketing", label: "Direct Marketing" },
        { href: "#anonymity", label: "Anonymity and Pseudonymity" },
        { href: "#security", label: "Security of Personal Information" },
        { href: "#access", label: "Accessing Your Personal Information (APP 12)" },
        { href: "#correction", label: "Correcting Your Personal Information (APP 13)" },
        { href: "#complaints", label: "Privacy Complaints and the OAIC" },
        { href: "#changes", label: "Changes to This Policy" },
        { href: "#contact", label: "Contact Us" },
      ]}
    >
      <section id="about">
        <h2>1. About This Policy and Who We Are</h2>
        <p>
          Crew Australia Pty Ltd (ACN 000 000 000) (&quot;Crew&quot;, &quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;) operates the Crew home services platform at getcrew.com.au. We are bound by the
          Privacy Act 1988 (Cth) and the 13 Australian Privacy Principles (APPs) contained in that Act.
        </p>
        <p>
          This Privacy Policy explains how we manage personal information about our users, including customers,
          contractors and visitors to our website. By using the Crew platform, you acknowledge that you have read
          and understood this Policy.
        </p>
        <LegalNote>
          This policy complies with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs 1 to
          13). Where this policy refers to a specific APP, that reference is noted in the section heading.
        </LegalNote>
      </section>

      <section id="what-we-collect">
        <h2>2. What Personal Information We Collect</h2>
        <p>We collect only the personal information reasonably necessary to provide and improve the Crew platform.</p>
        <h3>Account and identity information</h3>
        <ul>
          <li>Full name and date of birth</li>
          <li>Email address and mobile number</li>
          <li>Profile photograph</li>
          <li>Password (stored in hashed form, we cannot read it)</li>
        </ul>
        <h3>Contractor-specific verification information</h3>
        <ul>
          <li>Australian Business Number (ABN) or Australian Company Number (ACN)</li>
          <li>Trade licence numbers, licence categories and copies of licence documents</li>
          <li>Current public liability insurance certificate of currency</li>
          <li>Bank account details for payouts (BSB and account number)</li>
          <li>Identity verification documents, collected only for contractor onboarding and stored securely</li>
        </ul>
        <h3>Payment and transaction information</h3>
        <p>
          Full card numbers are handled exclusively by our escrow provider and are never stored on our systems.
          We retain transaction history, booking amounts and payout records.
        </p>
        <h3>Location information</h3>
        <p>
          Your nominated service postcode, used for contractor-to-customer matching, and GPS coordinates if you
          grant location permission, used for live job matching.
        </p>
        <h3>Platform usage and communications</h3>
        <p>
          Device type, browser version, IP address, pages visited, messages exchanged between customers and
          contractors, job photos and evidence, and reviews and ratings.
        </p>
      </section>

      <section id="how-we-collect">
        <h2>3. How We Collect Personal Information</h2>
        <p>Directly from you (creating an account, booking a service, uploading documents), automatically through cookies and server logs, and from third parties: identity verification providers, our escrow provider, government licensing databases, and social sign-in providers (Google or Apple, if you choose to use them).</p>
      </section>

      <section id="use">
        <h2>4. Why We Collect It and How We Use It</h2>
        <p>
          To provide the platform (matching, bookings, payments, payouts, invoices), for safety and trust
          (verifying licences and insurance, resolving disputes, preventing fraud), for communications and
          support, for platform improvement, and to meet our legal and tax obligations (including GST records).
        </p>
        <p>We will not use your personal information for a purpose other than the one it was collected for, or a directly related purpose, unless you consent or the law requires it.</p>
      </section>

      <section id="disclosure">
        <h2>5. Disclosure to Third Parties</h2>
        <p>
          We may disclose personal information to our escrow provider (to process payments and payouts), identity
          verification providers, analytics providers, email and notification providers, cloud infrastructure
          providers, professional advisers, and law enforcement or government authorities where required by law.
        </p>
        <LegalNote>
          We do not sell your personal information to third parties, and we do not share it for the purpose of
          serving third-party advertising.
        </LegalNote>
      </section>

      <section id="overseas">
        <h2>6. Overseas Disclosure of Personal Information (APP 8)</h2>
        <LegalNote>
          Australian Privacy Principle 8, cross-border disclosure: before disclosing personal information to an
          overseas recipient, we take reasonable steps to ensure the recipient does not breach the APPs in
          relation to that information.
        </LegalNote>
        <p>Some of our service providers are based outside Australia, so your personal information may be transferred to or processed in:</p>
        <h3>United States of America</h3>
        <ul>
          <li>Database and authentication services (Supabase, Inc.)</li>
          <li>Transactional email (Resend, Inc.)</li>
          <li>Escrow and payment processing infrastructure</li>
        </ul>
        <h3>European Union / European Economic Area</h3>
        <p>Some cloud infrastructure may route or store data through servers in the EU or EEA, subject to the GDPR.</p>
        <p>
          By using the Crew platform, you acknowledge that some overseas recipients may not be subject to a
          privacy law equivalent to the APPs, and that the Australian Privacy Commissioner may have limited
          jurisdiction over overseas entities.
        </p>
      </section>

      <section id="cookies">
        <h2>7. Cookies and Analytics</h2>
        <p>
          We use essential cookies (required for the platform to operate, including your signed-in session),
          analytics cookies (aggregated usage data), and preference cookies (your settings). You can disable or
          delete cookies through your browser settings at any time; disabling essential cookies will affect your
          ability to sign in.
        </p>
      </section>

      <section id="marketing">
        <h2>8. Direct Marketing</h2>
        <p>
          We may send you information about Crew services or promotions, in accordance with the Spam Act 2003
          (Cth) and the Do Not Call Register Act 2006 (Cth). You can opt out at any time by clicking
          &quot;Unsubscribe&quot; in any marketing email, updating your notification preferences in the app, or
          emailing <a href="mailto:privacy@getcrew.com.au">privacy@getcrew.com.au</a>. We never use sensitive
          information for direct marketing.
        </p>
      </section>

      <section id="anonymity">
        <h2>9. Anonymity and Pseudonymity</h2>
        <p>
          You may browse the Crew website without creating an account. However, booking or offering services
          requires a verified account, we cannot deal with you anonymously in that context because we must
          confirm your age and identity, verify contractor licences and insurance, and meet our anti-fraud and
          Know Your Customer obligations.
        </p>
      </section>

      <section id="security">
        <h2>10. Security of Personal Information</h2>
        <p>
          We encrypt data in transit (TLS/HTTPS) and sensitive data at rest, use role-based access controls, and
          regularly test our platform and infrastructure. If you believe your account has been compromised,
          contact <a href="mailto:security@getcrew.com.au">security@getcrew.com.au</a> immediately.
        </p>
        <p>
          We are required to notify affected individuals and the OAIC if a data breach is likely to result in
          serious harm, under the Notifiable Data Breaches scheme.
        </p>
      </section>

      <section id="access">
        <h2>11. Accessing Your Personal Information (APP 12)</h2>
        <p>
          You can update most account information directly in your Crew profile. For a broader access request,
          email <a href="mailto:privacy@getcrew.com.au">privacy@getcrew.com.au</a> with the subject line
          &quot;Personal Information Access Request&quot;. We will respond within 30 days, free of charge unless
          the request is unusually broad.
        </p>
      </section>

      <section id="correction">
        <h2>12. Correcting Your Personal Information (APP 13)</h2>
        <p>
          You can correct most account details directly in your settings. For anything not editable there, email{" "}
          <a href="mailto:privacy@getcrew.com.au">privacy@getcrew.com.au</a> with the subject line &quot;Personal
          Information Correction Request&quot;.
        </p>
      </section>

      <section id="complaints">
        <h2>13. Privacy Complaints and the OAIC</h2>
        <h3>Step 1: complain to Crew first</h3>
        <p>
          Email <a href="mailto:privacy@getcrew.com.au">privacy@getcrew.com.au</a> with the subject line
          &quot;Privacy Complaint&quot;. We will acknowledge your complaint within 5 business days and aim to
          resolve it within 30 days.
        </p>
        <h3>Step 2: refer to the OAIC if unresolved</h3>
        <p>
          If you are not satisfied with our response, you may contact the Office of the Australian Information
          Commissioner: <a href="https://www.oaic.gov.au" target="_blank" rel="noopener">www.oaic.gov.au</a>,
          phone 1300 363 992, or post to GPO Box 5218, Sydney NSW 2001.
        </p>
        <LegalNote>
          The OAIC is the independent statutory authority that handles privacy complaints about private sector
          organisations. There is no charge for lodging a complaint with the OAIC.
        </LegalNote>
      </section>

      <section id="changes">
        <h2>14. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we will notify you
          by email or a prominent notice on the platform. Continued use after changes take effect constitutes
          your acceptance of the revised policy.
        </p>
      </section>

      <section id="contact">
        <h2>15. Contact Us</h2>
        <ul>
          <li>
            Privacy: <a href="mailto:privacy@getcrew.com.au">privacy@getcrew.com.au</a>
          </li>
          <li>
            General enquiries: <a href="mailto:hello@getcrew.com.au">hello@getcrew.com.au</a>
          </li>
          <li>
            Security: <a href="mailto:security@getcrew.com.au">security@getcrew.com.au</a>
          </li>
        </ul>
        <p className="mt-6">
          Crew Australia Pty Ltd
          <br />
          ABN 00 000 000 000
          <br />
          Australia
        </p>
      </section>
    </LegalDoc>
  );
}
