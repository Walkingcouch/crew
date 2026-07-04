import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, email, phone, suburb, rating_avg, rating_count").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Profile</h1>
      <Card className="flex flex-col gap-2">
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Name</span>
          <span className="text-crew-ink">{profile?.full_name || "-"}</span>
        </div>
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Email</span>
          <span className="text-crew-ink">{profile?.email || user?.email}</span>
        </div>
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Mobile</span>
          <span className="text-crew-ink">{profile?.phone || "-"}</span>
        </div>
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Suburb</span>
          <span className="text-crew-ink">{profile?.suburb || "-"}</span>
        </div>
        {profile?.rating_avg != null && (
          <div className="flex justify-between py-1 text-sm">
            <span className="text-neutral-500">Your rating</span>
            <span className="text-crew-ink">⭐ {profile.rating_avg.toFixed(1)} ({profile.rating_count})</span>
          </div>
        )}
      </Card>
      <Link href="/customer/settings" className="mt-4 inline-block text-sm text-crew-green hover:underline">
        Edit settings
      </Link>
    </div>
  );
}
