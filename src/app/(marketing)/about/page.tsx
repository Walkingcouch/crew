import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Crew",
  description: "Crew connects Australians with verified, licensed tradespeople, backed by escrow-protected payments.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold text-crew-ink">About Crew</h1>
      <p className="mt-4 text-neutral-600">
        Crew is an Australian marketplace connecting customers with verified, licensed tradespeople, from lawn
        mowing and house cleaning through to electrical, plumbing and other licensed trade work.
      </p>
      <p className="mt-4 text-neutral-600">
        Every payment on Crew is held in escrow by CheckVault, an AFSL 429 768 holder, until the job is confirmed
        complete. Contractors are verified for licence and insurance before they can accept licensed trade work,
        and every job carries before and after photo evidence.
      </p>
      <p className="mt-4 text-neutral-600">
        We built Crew because booking a tradesperson in Australia should be as straightforward as booking a
        rideshare: transparent pricing, GST included, and your money protected until the work is done.
      </p>
    </div>
  );
}
