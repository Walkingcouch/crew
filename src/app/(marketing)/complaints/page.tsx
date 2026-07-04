import type { Metadata } from "next";
import { LegalDoc, LegalNote } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Complaints and Dispute Resolution",
  description: "How to raise a complaint with Crew and escalate to AFCA if needed.",
};

// DRAFT: requires legal review before launch
export default function ComplaintsPage() {
  return (
    <LegalDoc
      title="Complaints and Dispute Resolution"
      intro="How to raise a complaint with Crew, what happens next, and how to escalate if you are not satisfied with the outcome."
      effective="1 May 2026"
      updated="4 May 2026"
      toc={[
        { href: "#overview", label: "Our Commitment" },
        { href: "#job-disputes", label: "Job and Payment Disputes" },
        { href: "#general-complaints", label: "General Complaints" },
        { href: "#process", label: "Our Internal Process" },
        { href: "#timeframes", label: "Timeframes" },
        { href: "#escalation", label: "External Escalation (AFCA)" },
        { href: "#contact", label: "Contact Us" },
      ]}
    >
      <section id="overview">
        <h2>1. Our Commitment</h2>
        <p>
          Crew Australia Pty Ltd is committed to handling every complaint fairly, promptly and free of charge. This
          page explains how to raise a complaint, what to expect from us, and your right to take a complaint
          further if you are not satisfied with how we have handled it.
        </p>
        <p>
          This process applies to customers, contractors, and anyone else affected by the Crew platform, including
          complaints about a booking, a payment, the conduct of another user, or the platform itself.
        </p>
      </section>

      <section id="job-disputes">
        <h2>2. Job and Payment Disputes</h2>
        <p>
          If your complaint is about a specific booking (for example the work was not completed, was not done to a
          proper standard, or a payment has not been released or refunded correctly), raise it through the in-app
          dispute button on that booking first. This opens a dispute window during which escrow funds are held
          while we review the matter.
        </p>
        <p>
          Our dispute team reviews job photos, timestamp data, in-app messages, and any other evidence provided by
          both parties before deciding whether funds should be released to the contractor or refunded to the
          customer.
        </p>
        <LegalNote>
          Escrow with CheckVault: funds relating to a disputed booking stay held in trust while the dispute is
          open. Nothing is released or refunded until the dispute is resolved or the dispute window lapses.
        </LegalNote>
      </section>

      <section id="general-complaints">
        <h2>3. General Complaints</h2>
        <p>
          For anything not tied to a specific booking, for example a concern about the platform, an account
          decision, a privacy issue, or the conduct of our staff, contact us using the details in section 7.
          Please include:
        </p>
        <ul>
          <li>Your name and the email address on your Crew account</li>
          <li>A clear description of what happened and when</li>
          <li>Any booking reference numbers involved</li>
          <li>What outcome you are looking for</li>
        </ul>
      </section>

      <section id="process">
        <h2>4. Our Internal Process</h2>
        <ol>
          <li>
            <strong>Acknowledgement.</strong> We confirm receipt of your complaint and give you a reference
            number.
          </li>
          <li>
            <strong>Review.</strong> A member of our support team reviews the details and any evidence, and may
            contact you or the other party involved for more information.
          </li>
          <li>
            <strong>Decision.</strong> We tell you the outcome in writing, along with the reasons for our
            decision.
          </li>
          <li>
            <strong>Internal review.</strong> If you disagree with the outcome, you can ask for it to be reviewed
            by a more senior member of our team who was not involved in the original decision.
          </li>
          <li>
            <strong>External escalation.</strong> If you are still not satisfied, you can take the matter to the
            Australian Financial Complaints Authority (AFCA) for anything relating to escrow, payments or our
            AFSL-licensed escrow partner (see section 6).
          </li>
        </ol>
      </section>

      <section id="timeframes">
        <h2>5. Timeframes</h2>
        <ul>
          <li>We acknowledge every complaint within 2 business days.</li>
          <li>We aim to resolve job and payment disputes within 5 business days of receiving all the evidence we need.</li>
          <li>
            General complaints are usually resolved within 10 business days. If a complaint is complex and needs
            longer, we will tell you why and give you an updated timeframe.
          </li>
        </ul>
      </section>

      <section id="escalation">
        <h2>6. External Escalation (AFCA)</h2>
        <p>
          Crew&apos;s escrow payments are held by CheckVault, an AFSL 429 768 holder regulated by ASIC and a member
          of the Australian Financial Complaints Authority (AFCA) scheme. If your complaint is about the handling
          of escrow funds and you are not satisfied with our internal review, you can take it to AFCA free of
          charge.
        </p>
        <LegalNote>
          Australian Financial Complaints Authority: online at{" "}
          <a href="https://www.afca.org.au" target="_blank" rel="noopener">
            afca.org.au
          </a>
          , by phone on 1800 931 678, or by post to GPO Box 3, Melbourne VIC 3001. AFCA is free and independent.
        </LegalNote>
        <p>
          For complaints not related to escrow or payments (for example platform conduct or privacy matters), you
          can contact the Office of the Australian Information Commissioner for privacy-related concerns, see our{" "}
          <a href="/privacy">Privacy Policy</a> for details, or seek advice from your state&apos;s fair trading or
          consumer affairs body.
        </p>
      </section>

      <section id="contact">
        <h2>7. Contact Us</h2>
        <p>
          Email <a href="mailto:hello@getcrew.com.au">hello@getcrew.com.au</a> with &quot;Complaint&quot; in the
          subject line, or use the in-app dispute button for a specific booking. We are an Australian business and
          aim to respond during AEST business hours.
        </p>
      </section>
    </LegalDoc>
  );
}
