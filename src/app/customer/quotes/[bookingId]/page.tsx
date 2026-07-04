import { QuotesReview } from "./QuotesReview";

export default async function QuotesPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <QuotesReview bookingId={bookingId} />;
}
