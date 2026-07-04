"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AiRequest {
  task: "search" | "job-description" | "summarise" | "notification";
  input: string;
}

/** Calls /api/ai with a 30-second client-side timeout matching the
 * server's own AbortController, so a hung request fails fast with a
 * friendly message rather than spinning indefinitely. */
export function useAiAssistant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async ({ task, input }: AiRequest): Promise<string | null> => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Please sign in to use the assistant.");
        return null;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ task, input }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "The assistant is unavailable right now.");
        return null;
      }
      return data.result as string;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("The assistant took too long to respond. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      return null;
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  return { ask, loading, error };
}
