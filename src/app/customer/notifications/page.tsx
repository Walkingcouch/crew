import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: notifications } = user
    ? await supabase
        .from("notifications")
        .select("id, title, body, link, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Notifications</h1>
      {!notifications || notifications.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <Link key={n.id} href={n.link || "#"}>
              <Card className={n.read ? "opacity-70" : ""}>
                <p className="text-sm font-semibold text-crew-ink">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-neutral-500">{n.body}</p>}
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(n.created_at).toLocaleString("en-AU")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
