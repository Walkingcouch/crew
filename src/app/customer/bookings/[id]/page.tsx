import { BookingDetail } from "./BookingDetail";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetail bookingId={id} />;
}
