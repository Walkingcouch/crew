"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

interface Entry {
  id: number;
  email: string;
  note: string | null;
  added_at: string;
}

export function BetaAllowlistView() {
  const toast = useToast();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const headers = await authHeader();
    const res = await fetch("/api/admin/beta-allowlist", { headers });
    const data = await res.json();
    setEntries(data.allowlist || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return toast.show("Enter a valid email", "error");
    setBusy(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/admin/beta-allowlist", { method: "POST", headers, body: JSON.stringify({ email, note }) });
    setBusy(false);
    if (!res.ok) return toast.show("Could not add email", "error");
    setEmail("");
    setNote("");
    toast.show("Added to allowlist", "success");
    load();
  }

  async function removeEmail(target: string) {
    const headers = await authHeader();
    await fetch(`/api/admin/beta-allowlist?email=${encodeURIComponent(target)}`, { method: "DELETE", headers });
    toast.show("Removed", "success");
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Beta allowlist</h1>

      <form onSubmit={addEmail} className="mb-4 flex gap-2">
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
        <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
        <Button type="submit" disabled={busy} className="mt-6">
          Add
        </Button>
      </form>

      {entries === null ? (
        <Skeleton className="h-24 w-full" />
      ) : entries.length === 0 ? (
        <EmptyState icon="🔒" title="No emails on the allowlist yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crew-ink">{entry.email}</p>
                {entry.note && <p className="text-xs text-neutral-400">{entry.note}</p>}
              </div>
              <Button size="sm" variant="destructive" onClick={() => removeEmail(entry.email)}>
                Remove
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
