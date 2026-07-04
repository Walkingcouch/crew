import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "For Contractors",
  description: "Grow your trade business on Crew: fixed-price jobs, Get Quotes bookings, and escrow-protected payouts.",
};

const BENEFITS = [
  { title: "Escrow-protected payouts", body: "Funds are secured before you start, and released to your bank account within 1 to 2 business days of job completion." },
  { title: "Get Quotes bookings", body: "Quote your own price on open jobs in your service area, ranked by price and rating." },
  { title: "Recurring work", body: "Weekly, fortnightly or monthly repeat bookings from your regular customers, automatically." },
  { title: "Fair commission", body: "10% for sole traders, 6% for enterprise accounts, shown transparently before every payout." },
];

export default function ContractorsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-crew-ink sm:text-4xl">Grow your trade business on Crew</h1>
        <p className="mt-4 text-neutral-600">
          Verified licence and insurance checks, escrow-protected payments, and a steady stream of local jobs.
        </p>
        <div className="mt-6">
          <LinkButton size="lg" href="/login?mode=signup&role=contractor">
            Become a contractor
          </LinkButton>
        </div>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <Card key={benefit.title}>
            <p className="font-semibold text-crew-ink">{benefit.title}</p>
            <p className="mt-1 text-sm text-neutral-500">{benefit.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
