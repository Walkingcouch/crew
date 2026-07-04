"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function UsersView() {
  const toast = useToast();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    setUsers(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePause(user: Profile) {
    setBusyId(user.id);
    const paused = !user.paused;
    const reason = paused ? window.prompt("Reason for pausing this user:") || "Paused by admin" : undefined;
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/admin/pause-user", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId: user.id, paused, reason }),
    });
    setBusyId(null);
    if (!res.ok) return toast.show("Could not update user", "error");
    toast.show(paused ? "User paused" : "User unpaused", "success");
    load();
  }

  if (users === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const filtered = users.filter(
    (u) => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Users &amp; organisations</h1>
      <div className="mb-4">
        <Input label="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        {filtered.map((user) => (
          <Card key={user.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-crew-ink">{user.full_name || user.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone="info">{user.role.replace("_", " ")}</Badge>
                {user.paused && <Badge tone="danger">Paused: {user.paused_reason}</Badge>}
              </div>
            </div>
            <Button size="sm" variant={user.paused ? "secondary" : "destructive"} disabled={busyId === user.id} onClick={() => togglePause(user)}>
              {user.paused ? "Unpause" : "Pause"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
