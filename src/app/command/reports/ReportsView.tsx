"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { Database } from "@/lib/supabase/database.types";

type Report = Database["public"]["Tables"]["community_reports"]["Row"];

const STATUS_OPTIONS: Report["status"][] = ["open", "assigned", "in_progress", "resolved", "closed"];
const SEVERITY_TONE: Record<Report["severity"], "neutral" | "warning" | "danger"> = {
  Low: "neutral",
  Medium: "warning",
  High: "danger",
  Critical: "danger",
};

export function ReportsView() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("community_reports").select("*").order("created_at", { ascending: false });
    setReports(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: Report["status"]) {
    const supabase = createClient();
    const { error } = await supabase.from("community_reports").update({ status }).eq("id", id);
    if (error) return toast.show(error.message, "error");
    toast.show("Status updated", "success");
    load();
  }

  if (reports === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Community reports</h1>
      {reports.length === 0 ? (
        <EmptyState icon="📍" title="No community reports" />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-crew-ink">{report.issue_type}</p>
                  <p className="text-sm text-neutral-500">{report.location}</p>
                  {report.description && <p className="mt-1 text-sm text-neutral-600">{report.description}</p>}
                </div>
                <Badge tone={SEVERITY_TONE[report.severity]}>{report.severity}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-neutral-400">{report.ref}</span>
                <Select
                  label="Status"
                  value={report.status}
                  onChange={(e) => updateStatus(report.id, e.target.value as Report["status"])}
                  className="ml-auto w-40 text-xs"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
