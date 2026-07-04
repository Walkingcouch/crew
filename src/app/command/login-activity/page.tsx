import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function LoginActivityPage() {
  const supabase = await createServerSupabaseClient();
  const { data: attempts } = await supabase
    .from("login_attempts")
    .select("id, email, outcome, note, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Login activity</h1>
      {!attempts || attempts.length === 0 ? (
        <EmptyState icon="🔑" title="No login activity recorded yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {attempts.map((attempt) => (
            <Card key={attempt.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crew-ink">{attempt.email || "Unknown"}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(attempt.created_at).toLocaleString("en-AU")} {attempt.ip && `- ${attempt.ip}`}
                </p>
              </div>
              <Badge tone={attempt.outcome === "success" ? "success" : "danger"}>{attempt.outcome}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
