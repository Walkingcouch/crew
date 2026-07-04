"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

interface QueueItem {
  id: string;
  kind: string;
  number: string | null;
  expires_at: string | null;
  document_path: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

export function VerificationQueue() {
  const toast = useToast();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeader();
    const res = await fetch("/api/credentials/verification-queue", { headers });
    const data = await res.json();
    setQueue(data.queue || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function verify(id: string) {
    setBusyId(id);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch(`/api/credentials/${id}/verify`, { method: "POST", headers });
    setBusyId(null);
    if (!res.ok) return toast.show("Could not verify credential", "error");
    toast.show("Credential verified", "success");
    load();
  }

  async function reject(id: string) {
    const reason = window.prompt("Reason for rejection (shown to the contractor):");
    if (reason === null) return;
    setBusyId(id);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch(`/api/credentials/${id}/reject`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason }),
    });
    setBusyId(null);
    if (!res.ok) return toast.show("Could not reject credential", "error");
    toast.show("Credential rejected", "success");
    load();
  }

  if (queue === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Credential verification queue</h1>
      {queue.length === 0 ? (
        <EmptyState icon="🪪" title="Nothing pending verification" />
      ) : (
        <div className="flex flex-col gap-3">
          {queue.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-crew-ink">{item.profiles?.full_name || item.profiles?.email}</p>
                  <p className="text-sm text-neutral-500 capitalize">{item.kind.replace("_", " ")} {item.number && `- ${item.number}`}</p>
                  {item.expires_at && (
                    <p className="text-xs text-neutral-400">Expires {new Date(item.expires_at).toLocaleDateString("en-AU")}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={busyId === item.id} onClick={() => verify(item.id)}>
                  Verify
                </Button>
                <Button size="sm" variant="destructive" disabled={busyId === item.id} onClick={() => reject(item.id)}>
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
