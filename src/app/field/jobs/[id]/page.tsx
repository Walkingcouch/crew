import { JobDetail } from "@/app/pro/jobs/[id]/JobDetail";

export default async function FieldJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetail bookingId={id} />;
}
