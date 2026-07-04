import { BookingAdmin } from "./BookingAdmin";

export default async function CommandBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingAdmin bookingId={id} />;
}
