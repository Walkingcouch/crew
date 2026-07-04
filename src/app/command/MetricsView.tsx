"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { SimpleBarChart } from "@/components/shared/SimpleBarChart";
import { authHeader } from "@/lib/api-client";

interface MetricsResponse {
  gmvDaily: { day: string; gmv_cents: number | null }[];
  takeRate: { day: string; take_rate: number | null }[];
  disputes: { week: string; disputed: number; total: number; dispute_pct: number | null }[];
  timeToMatch: { day: string; avg_hours_to_complete: number | null }[];
  contractorUtilisation: { contractor_id: string; jobs_last_30d: number }[];
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit" });
}

export function MetricsView() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const headers = await authHeader();
      const res = await fetch("/api/admin/metrics", { headers });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load metrics");
        return;
      }
      setData(json);
    })();
  }, []);

  if (error) return <p className="p-6 text-sm text-crew-red">{error}</p>;
  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const gmvSeries = [...data.gmvDaily].reverse().slice(-30);
  const takeRateSeries = [...data.takeRate].reverse().slice(-30);
  const timeToMatchSeries = [...data.timeToMatch].reverse().slice(-30);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Platform metrics (last 30 days)</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-semibold text-crew-ink">GMV per day</p>
          <SimpleBarChart
            data={gmvSeries.map((d) => ({ label: formatDay(d.day), value: (d.gmv_cents || 0) / 100 }))}
            valueFormatter={(v) => `$${v.toFixed(0)}`}
          />
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold text-crew-ink">Take rate</p>
          <SimpleBarChart
            data={takeRateSeries.map((d) => ({ label: formatDay(d.day), value: (d.take_rate || 0) * 100 }))}
            valueFormatter={(v) => `${v.toFixed(1)}%`}
          />
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold text-crew-ink">Time to match (hours)</p>
          <SimpleBarChart
            data={timeToMatchSeries.map((d) => ({ label: formatDay(d.day), value: d.avg_hours_to_complete || 0 }))}
            valueFormatter={(v) => `${v.toFixed(1)}h`}
          />
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold text-crew-ink">Dispute ratio (weekly)</p>
          <div className="flex flex-col gap-1">
            {data.disputes.slice(0, 6).map((d) => (
              <div key={d.week} className="flex justify-between text-sm">
                <span className="text-neutral-500">Week of {formatDay(d.week)}</span>
                <span className="font-semibold text-crew-ink">{d.dispute_pct ?? 0}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold text-crew-ink">Top contractors (last 30 days)</p>
          <div className="flex flex-col gap-1">
            {data.contractorUtilisation.slice(0, 8).map((c) => (
              <div key={c.contractor_id} className="flex justify-between text-sm">
                <span className="truncate text-neutral-500">{c.contractor_id.slice(0, 8)}</span>
                <span className="font-semibold text-crew-ink">{c.jobs_last_30d} jobs</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
