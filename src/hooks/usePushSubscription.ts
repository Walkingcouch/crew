"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Web Push subscribe/unsubscribe, only ever called from a real tap (the
 * settings toggle or the opt-in card's button), never on page load,
 * requesting Notification permission on load would be intrusive and most
 * browsers now block it. */
export function usePushSubscription() {
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
    (async () => {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (!registration) return;
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    })();
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const configRes = await fetch("/api/config");
    const config = await configRes.json();
    if (!config.vapidPublicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
    });

    const headers = await authHeader();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    setSubscribed(true);
    return true;
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      setSubscribed(false);
      return;
    }
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const headers = await authHeader();
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ endpoint }),
    });
    setSubscribed(false);
  }, []);

  return { supported, subscribed, subscribe, unsubscribe };
}
