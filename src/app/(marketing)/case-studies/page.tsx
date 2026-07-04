import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Case Studies",
  description: "How Australian customers and contractors use Crew.",
};

const CASE_STUDIES = [
  {
    title: "A Brisbane property manager cut no-show rates to near zero",
    body: "Switching recurring lawn care bookings to Crew's escrow model meant contractors were paid reliably, and no-shows dropped once payment was guaranteed on completion.",
  },
  {
    title: "A licensed electrician doubled bookings with Get Quotes",
    body: "Rather than waiting for fixed-price jobs, quoting directly on open jobs in his service area let him win work at his own price.",
  },
  {
    title: "A Melbourne share house resolved a dispute in 3 days",
    body: "Before and after photos and in-app messaging gave Crew's dispute team everything needed to resolve a cleaning complaint fairly and fast.",
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold text-crew-ink">Case studies</h1>
      <p className="mt-3 text-neutral-600">How Australian customers and contractors use Crew.</p>
      <div className="mt-10 grid gap-4">
        {CASE_STUDIES.map((study) => (
          <Card key={study.title}>
            <p className="font-semibold text-crew-ink">{study.title}</p>
            <p className="mt-2 text-sm text-neutral-500">{study.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
