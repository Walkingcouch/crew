"use client";

import { useEffect, useState } from "react";

/**
 * Registers public/sw.js and detects a genuinely new version, distinct
 * from the very first install: `updatefound` fires on first install too,
 * so "there is already a controller" is the signal that this is a repeat
 * visit finding a newer worker, not a first-time install, which is the
 * only case that should show an "update available" prompt.
 */
export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (cancelled) return;

      const hadController = !!navigator.serviceWorker.controller;

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && hadController) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function applyUpdate() {
    waitingWorker?.postMessage("SKIP_WAITING");
    window.location.reload();
  }

  return { updateAvailable, applyUpdate };
}
