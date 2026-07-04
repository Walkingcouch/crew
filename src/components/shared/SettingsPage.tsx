"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

/** Shared settings screen (push toggle, sign out, account deletion
 * request) reused across every role surface, only the "back to" link
 * differs per surface. */
export function SettingsPage({ homeHref }: { homeHref: string }) {
  const router = useRouter();
  const toast = useToast();
  const { supported, subscribed, subscribe, unsubscribe } = usePushSubscription();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function togglePush() {
    if (subscribed) await unsubscribe();
    else await subscribe();
  }

  async function requestAccountDeletion() {
    // No self-service delete: removing an auth.users row needs the
    // service-role key, and admin_notifications has no client insert
    // policy (admin-only table by design), so this goes through a Route
    // Handler that calls notifyAdmin() server-side instead.
    const headers = await authHeader();
    await fetch("/api/account/request-deletion", { method: "POST", headers });
    setDeleteDialogOpen(false);
    toast.show("Deletion request sent. We will action this within 30 days.", "success");
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Settings</h1>

      <Card className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-crew-ink">Push notifications</p>
          <p className="text-xs text-neutral-500">{supported ? "Get notified about job updates" : "Not supported on this device"}</p>
        </div>
        <Button size="sm" variant={subscribed ? "secondary" : "primary"} disabled={!supported} onClick={togglePush}>
          {subscribed ? "Turn off" : "Turn on"}
        </Button>
      </Card>

      <Card className="mb-4">
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold text-crew-ink">Delete account</p>
        <p className="mb-3 text-xs text-neutral-500">
          Your data will be deleted within 30 days per the Australian Privacy Act.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
          Request deletion
        </Button>
      </Card>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} title="Delete your account?">
        <p className="mb-4 text-sm text-neutral-600">
          This sends a deletion request to our team. Your data will be removed within 30 days. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={requestAccountDeletion}>
            Confirm request
          </Button>
          <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>

      <a href={homeHref} className="mt-4 inline-block text-sm text-crew-green hover:underline">
        Back
      </a>
    </div>
  );
}
