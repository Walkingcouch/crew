import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Book verified, licensed tradespeople across Australia",
  description:
    "Crew connects you with verified, licensed contractors for home and commercial services. Escrow-protected payments, GST-inclusive pricing, no surprises.",
};

const SERVICES = [
  "Lawn mowing", "Garden maintenance", "House cleaning", "Electrical",
  "Plumbing", "Handyman", "Pest control", "Pool care", "Window cleaning",
  "Pressure washing", "Tree lopping", "Painting", "Carpet cleaning",
  "Gutter cleaning", "Rubbish removal", "Air conditioning", "Solar cleaning",
  "Roof repairs", "Fencing", "Tiling", "Locksmith", "Pet care",
];

const STEPS = [
  { title: "Book a service", body: "Choose a fixed-price job or request quotes from local contractors." },
  { title: "Pay into escrow", body: "Funds are held securely by CheckVault until the job is confirmed complete." },
  { title: "Job gets done", body: "A verified, licensed contractor completes the work and uploads before and after photos." },
  { title: "Release payment", body: "Confirm you're happy, and payment releases to your contractor within 1 to 2 business days." },
];

export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-b from-crew-green/10 to-white px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-crew-ink sm:text-5xl">
            Book verified, licensed tradespeople across Australia
          </h1>
          <p className="mt-4 text-lg text-neutral-600">
            Escrow-protected payments, GST-inclusive pricing, and a satisfaction guarantee on every job.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton size="lg" href="/login?mode=signup&role=customer">
              Book a service
            </LinkButton>
            <LinkButton size="lg" variant="secondary" href="/login?mode=signup&role=contractor">
              Become a contractor
            </LinkButton>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-crew-ink">Services available near you</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {SERVICES.map((service) => (
            <span
              key={service}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700"
            >
              {service}
            </span>
          ))}
        </div>
      </section>

      <section id="how" className="bg-neutral-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-crew-ink">How Crew works</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <Card key={step.title}>
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-crew-green text-sm font-bold text-white">
                  {index + 1}
                </div>
                <p className="font-semibold text-crew-ink">{step.title}</p>
                <p className="mt-1 text-sm text-neutral-500">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-crew-ink">Transparent, GST-inclusive pricing</h2>
        <p className="mt-3 text-neutral-600">
          Every price you see includes GST. No hidden fees, no surprise call-out charges.
        </p>
        <div className="mt-8">
          <LinkButton size="lg" href="/login?mode=signup">
            Get started
          </LinkButton>
        </div>
      </section>
    </>
  );
}
