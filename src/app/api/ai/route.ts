import { authenticateRequest } from "@/server/lib/auth-adapter";

/**
 * AI proxy: Anthropic if ANTHROPIC_API_KEY is set (works from Vercel), else
 * a local Ollama instance at OLLAMA_URL (dev only), else a graceful 503.
 * Ported from the legacy server.js /api/ai (see DECISIONS.md, that
 * endpoint was found hardcoded to localhost:11434 with no working
 * fallback and fixed there; this Route Handler carries that fix forward).
 */

const AI_PROMPTS: Record<string, (input: string) => string> = {
  search: (q) =>
    `You are a friendly support agent for Crew, an Australian service marketplace. Answer the question below using only the FAQ knowledge provided. Be concise (1 to 3 sentences) and helpful.\n\nFAQ knowledge:\n- Escrow payments: customer funds are held securely by CheckVault until the job is confirmed complete. Released to the contractor within 1 to 2 business days.\n- Contractor verification: all contractors have a verified ABN, government-issued photo ID, and active public liability insurance before accepting jobs.\n- Booking: choose a service type, date and location, and get matched with an available verified contractor, or request quotes.\n- Cancellation: free cancellation up to 2 hours before the job start time. A 25% fee applies for later cancellations.\n- Payments: GST (10%) is included in all displayed prices.\n- Disputes: raise a dispute within the window shown on the booking. Funds are held until resolved.\n- Ratings: rate your contractor after each completed job.\n- Refunds: full refund if the job is not completed.\n\nQuestion: ${q}\n\nAnswer:`,
  "job-description": (details) =>
    `You are a professional copywriter for a service marketplace. Write a clear, professional 2-sentence job description based on these details. Output only the description text.\n\nJob details: ${details}`,
  summarise: (text) => `Summarise the following in 1 to 2 clear sentences. Output only the summary.\n\n${text}`,
  notification: (event) =>
    `Write a short, friendly push notification (under 100 characters) for this event: ${event}\nOutput only the notification text, no quotes.`,
};

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { task = "search", input, model = "llama3.2:1b" } = body as { task?: string; input?: string; model?: string };

  if (!input || typeof input !== "string" || input.trim().length === 0) {
    return Response.json({ error: "input is required" }, { status: 400 });
  }
  if (input.length > 2000) {
    return Response.json({ error: "input too long (max 2000 chars)" }, { status: 400 });
  }
  const promptFn = AI_PROMPTS[task];
  if (!promptFn) {
    return Response.json({ error: `unknown task "${task}". Valid: ${Object.keys(AI_PROMPTS).join(", ")}` }, { status: 400 });
  }

  const prompt = promptFn(input.trim());

  if (process.env.ANTHROPIC_API_KEY) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
      if (!anthropicRes.ok) throw new Error(`Anthropic responded ${anthropicRes.status}`);
      const data = await anthropicRes.json();
      const result = (data.content?.[0]?.text || "").trim();
      return Response.json({ result, model: "claude-haiku-4-5", task });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return Response.json({ error: "The assistant took too long to respond. Please try again." }, { status: 503 });
      }
      return Response.json({ error: "AI service unavailable" }, { status: 503 });
    } finally {
      clearTimeout(timer);
    }
  }

  if (process.env.OLLAMA_URL) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const ollamaRes = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.3, num_predict: 250 } }),
        signal: controller.signal,
      });
      if (!ollamaRes.ok) throw new Error(`Ollama responded ${ollamaRes.status}`);
      const data = await ollamaRes.json();
      const result = (data.response || "").trim();
      return Response.json({ result, model, task });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return Response.json({ error: "The assistant took too long to respond. Please try again." }, { status: 503 });
      }
      return Response.json({ error: "AI service unavailable" }, { status: 503 });
    } finally {
      clearTimeout(timer);
    }
  }

  return Response.json({ error: "AI assistant is not configured" }, { status: 503 });
}
