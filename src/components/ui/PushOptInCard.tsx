"use client";

import { useState } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Dismissible card prompting the user to turn on notifications, shown
 * once per session at most. Permission is only requested when the user
 * actually taps "Turn on", never automatically. */
export function PushOptInCard() {
  const { supported, subscribed, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (!supported || subscribed || dismissed) return null;

  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-crew-ink">Turn on notifications</p>
        <p className="text-xs text-neutral-500">Get notified about quotes, job updates and payments.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => subscribe()}>
          Turn on
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
