import type { Metadata } from "next";
import { LegalDoc, LegalNote } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Crew's terms and conditions for customers and contractors.",
};

// DRAFT: requires legal review before launch
export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms and Conditions"
      intro="Please read these terms carefully before using the Crew platform."
      effective="1 May 2026"
      updated="4 May 2026"
      toc={[
        { href: "#acceptance", label: "Acceptance of Terms" },
        { href: "#services", label: "Platform Services" },
        { href: "#accounts", label: "User Accounts and Eligibility" },
        { href: "#contractors", label: "Contractor Obligations" },
        { href: "#customers", label: "Customer Obligations" },
        { href: "#payments", label: "Payments and Escrow" },
        { href: "#disputes", label: "Disputes and Resolution" },
        { href: "#privacy", label: "Privacy and Data" },
        { href: "#liability", label: "Limitation of Liability" },
        { href: "#termination", label: "Termination" },
        { href: "#contact", label: "Contact Us" },
      ]}
    >
      <section id="acceptance">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the Crew platform (the &quot;Platform&quot;), you agree to be bound by these Terms
          and Conditions (&quot;Terms&quot;). If you do not agree to these Terms, you must not use the Platform.
        </p>
        <p>
          These Terms form a legally binding agreement between you and Crew Australia Pty Ltd (ACN 000 000 000)
          (&quot;Crew&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). We reserve the right to update these
          Terms at any time. We will notify you of material changes by email or platform notification. Continued
          use after changes constitutes acceptance.
        </p>
      </section>

      <section id="services">
        <h2>2. Platform Services</h2>
        <p>
          Crew is an online marketplace that connects customers seeking home and commercial services with
          independent contractors offering those services. Crew is not a party to any service agreement between
          customers and contractors, we provide the technology and infrastructure to facilitate these connections.
        </p>
        <p>Services available on the Platform include (but are not limited to):</p>
        <ul>
          <li>Lawn and garden maintenance</li>
          <li>House and commercial cleaning</li>
          <li>Pet care and grooming</li>
          <li>Handyman and maintenance tasks</li>
          <li>Interior and exterior painting</li>
          <li>Licensed trade work (electrical, plumbing, HVAC, building)</li>
          <li>Tree lopping and arborist services</li>
        </ul>
        <LegalNote>
          Licensed trades: Crew verifies that contractors hold the applicable licence and current insurance before
          they may offer licensed trade services on the Platform. Customers should also verify the contractor&apos;s
          licence independently using the relevant state licensing authority.
        </LegalNote>
      </section>

      <section id="accounts">
        <h2>3. User Accounts and Eligibility</h2>
        <h3>Eligibility</h3>
        <p>
          You must be at least 18 years of age and legally capable of entering a binding contract to use the
          Platform. By creating an account, you represent and warrant that you meet these requirements.
        </p>
        <h3>Account Security</h3>
        <p>
          You are responsible for keeping your account credentials secure. You must notify us immediately at{" "}
          <a href="mailto:security@getcrew.com.au">security@getcrew.com.au</a> if you suspect unauthorised access
          to your account.
        </p>
        <h3>Accurate Information</h3>
        <p>
          You agree to provide accurate, current and complete information when creating your account and to update
          this information as required to keep it accurate.
        </p>
      </section>

      <section id="contractors">
        <h2>4. Contractor Obligations</h2>
        <p>By registering as a contractor on Crew, you agree to the following:</p>
        <ul>
          <li>You are an independent contractor, not an employee of Crew</li>
          <li>You hold all required licences, insurances and registrations for the services you offer</li>
          <li>You will complete services described to a professional standard</li>
          <li>You will take accurate before and after photographs for every completed job</li>
          <li>You will not engage in deceptive, fraudulent or misleading conduct</li>
          <li>You are responsible for your own tax obligations, including GST registration where applicable</li>
          <li>You will comply with all applicable work health and safety requirements</li>
        </ul>
        <h3>Commission</h3>
        <p>
          Crew charges a service fee (commission) on each completed job. Commission rates are shown transparently
          in your dashboard and are automatically applied at the time of payout. The current rate schedule is
          published on our pricing page. Crew reserves the right to adjust commission rates with 30 days&apos;
          written notice.
        </p>
      </section>

      <section id="customers">
        <h2>5. Customer Obligations</h2>
        <p>By using the Platform as a customer, you agree to:</p>
        <ul>
          <li>Provide accurate job descriptions and location information</li>
          <li>Be present or make access arrangements at the agreed time</li>
          <li>Release escrow funds promptly once the job is completed to your satisfaction</li>
          <li>Not misuse the dispute process or make false claims against contractors</li>
          <li>Treat contractors with respect and professionalism</li>
        </ul>
      </section>

      <section id="payments">
        <h2>6. Payments and Escrow</h2>
        <p>
          All payments are processed securely through Crew&apos;s escrow system, provided by CheckVault (AFSL 429
          768). When you book a service, funds are held in a segregated trust account and only released to the
          contractor once you confirm the job is complete.
        </p>
        <h3>Booking Fees</h3>
        <p>A booking fee may apply for free-tier customer accounts. Crew Pass subscribers have booking fees waived as part of their subscription.</p>
        <h3>Contractor Payouts</h3>
        <p>
          Contractor payouts are processed by our escrow provider and typically reach your nominated bank account
          within 1 to 2 business days of release. Payout timing may vary depending on your bank.
        </p>
        <h3>Refunds</h3>
        <p>
          If a service is not completed or is significantly different from what was described, customers may
          request a refund through the dispute process. All refund decisions are at Crew&apos;s discretion based on
          the evidence provided.
        </p>
      </section>

      <section id="disputes">
        <h2>7. Disputes and Resolution</h2>
        <p>
          In the event of a dispute between a customer and contractor, both parties are encouraged to first attempt
          to resolve the matter directly through in-app messaging.
        </p>
        <p>
          If a resolution cannot be reached, either party may escalate to Crew&apos;s dispute resolution team. Our
          team will review job photos, job notes and communications as evidence. We aim to resolve all disputes
          within 5 business days.
        </p>
        <LegalNote>
          Photo evidence matters: contractors are required to upload before and after photos. These are used as
          primary evidence in any dispute. Failure to upload photos may affect the outcome of a dispute in favour
          of the customer.
        </LegalNote>
        <p>
          Crew&apos;s decision on disputes is final within the Platform. This does not affect any statutory rights
          you may have under Australian Consumer Law.
        </p>
      </section>

      <section id="privacy">
        <h2>8. Privacy and Data</h2>
        <p>
          Your privacy is important to us. We collect, use and disclose personal information in accordance with the
          Australian Privacy Act 1988 and our Privacy Policy.
        </p>
        <p>By using the Platform you consent to the collection and use of your personal information as described in our Privacy Policy, including:</p>
        <ul>
          <li>Identity verification documents (stored securely, not shared with third parties)</li>
          <li>Job photos and evidence materials</li>
          <li>Communications on the Platform</li>
        </ul>
      </section>

      <section id="liability">
        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Crew&apos;s total liability to you for any claim arising out of or
          related to your use of the Platform is limited to the fees paid by you to Crew in the 3 months preceding
          the claim.
        </p>
        <p>
          Crew is not liable for the quality, safety or legality of services provided by contractors, the truth or
          accuracy of user content, or the ability of contractors to perform services or customers to pay for them.
        </p>
        <p>
          Nothing in these Terms excludes, restricts or modifies any guarantee, warranty, right or remedy conferred
          on you by the Australian Consumer Law that cannot be excluded, restricted or modified.
        </p>
      </section>

      <section id="termination">
        <h2>10. Termination</h2>
        <p>
          You may close your account at any time by contacting us at{" "}
          <a href="mailto:hello@getcrew.com.au">hello@getcrew.com.au</a>.
        </p>
        <p>
          Crew may suspend or terminate your account if you breach these Terms, engage in fraudulent or illegal
          activity, receive a pattern of serious complaints, or pose a risk to the safety of other users or the
          Platform.
        </p>
      </section>

      <section id="contact">
        <h2>11. Contact Us</h2>
        <p>For questions about these Terms, privacy, or any other matter:</p>
        <ul>
          <li>
            Email: <a href="mailto:hello@getcrew.com.au">hello@getcrew.com.au</a>
          </li>
          <li>
            Legal enquiries: <a href="mailto:legal@getcrew.com.au">legal@getcrew.com.au</a>
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
