import { JobDetail } from "./JobDetail";

export default async function ProJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetail bookingId={id} />;
}
