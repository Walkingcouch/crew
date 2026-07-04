"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";
import type { Database } from "@/lib/supabase/database.types";

type Credential = Database["public"]["Tables"]["contractor_credentials"]["Row"];

const KIND_LABEL: Record<Credential["kind"], string> = {
  licence: "Trade licence",
  insurance: "Public liability insurance",
  photo_id: "Photo ID",
};

export function CredentialsView() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [pausedReason, setPausedReason] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<Credential["kind"] | null>(null);
  const [number, setNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("paused, paused_reason").eq("id", user.id).single();
    setPaused(!!profile?.paused);
    setPausedReason(profile?.paused_reason || null);

    const headers = await authHeader();
    const res = await fetch("/api/credentials", { headers });
    const data = await res.json();
    setCredentials(data.credentials || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCredential(kind: Credential["kind"]) {
    if (!expiresAt) return toast.show("Enter an expiry date", "error");
    setSaving(true);

    let documentPath: string | undefined;
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const path = `${user.id}/${kind}-${Date.now()}.${file.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("credentials").upload(path, file);
        if (!error) documentPath = path;
      }
    }

    const headers = await authHeader();
    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ kind, number: number || undefined, expiresAt: new Date(expiresAt).toISOString(), documentPath }),
    });
    const data = await res.json();
    setSaving(false);
    setUploadKind(null);
    setNumber("");
    setExpiresAt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!res.ok) return toast.show(data.error || "Could not save credential", "error");
    toast.show("Credential submitted for verification", "success");
    load();
  }

  if (credentials === null) return null;

  const kinds: Credential["kind"][] = ["licence", "insurance", "photo_id"];

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Credentials</h1>

      {paused && (
        <Card className="mb-4 border-crew-red bg-red-50">
          <p className="text-sm font-semibold text-crew-red">Your account is paused</p>
          <p className="mt-1 text-sm text-neutral-600">{pausedReason || "A credential has expired."} Renew it below to resume taking jobs.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {kinds.map((kind) => {
          const existing = credentials.find((c) => c.kind === kind);
          const expired = existing?.expires_at && new Date(existing.expires_at) < new Date();

          return (
            <Card key={kind}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-crew-ink">{KIND_LABEL[kind]}</p>
                  {existing ? (
                    <p className={`text-xs ${expired ? "text-crew-red" : "text-neutral-500"}`}>
                      {existing.verified ? "Verified" : "Pending verification"}
                      {existing.expires_at && ` · Expires ${new Date(existing.expires_at).toLocaleDateString("en-AU")}`}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-400">Not submitted</p>
                  )}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setUploadKind(kind)}>
                  {existing ? "Renew" : "Add"}
                </Button>
              </div>

              {uploadKind === kind && (
                <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
                  <Input label="Licence/certificate number" value={number} onChange={(e) => setNumber(e.target.value)} />
                  <Input label="Expiry date" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="text-xs" />
                  <Button size="sm" disabled={saving} onClick={() => saveCredential(kind)}>
                    {saving ? "Saving..." : "Submit"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
