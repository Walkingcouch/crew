/**
 * CrewAI — lightweight client for the local Ollama AI proxy at /api/ai
 * All inference runs on gemma3n locally; no external API tokens consumed.
 *
 * Usage:
 *   const { result } = await CrewAI.search('How does escrow work?');
 *   const { result } = await CrewAI.jobDescription('Weekly lawn mow, 600m² block, Bondi');
 */
const CrewAI = (() => {
  const ENDPOINT = '/api/ai';
  const DEFAULT_MODEL = 'llama3.2:1b';

  const TIMEOUT_MS = 30000;

  async function call(task, input, model = DEFAULT_MODEL) {
    if (!input || !input.trim()) return { error: 'No input provided' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, input: input.trim(), model }),
        signal: controller.signal,
      });
      if (res.status === 429) return { error: 'Too many requests, try again shortly.' };
      if (res.status === 503) return { error: 'AI assistant is offline. Try emailing hello@getcrew.com.au.' };
      if (!res.ok) return { error: `Request failed (${res.status})` };
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        return { error: 'The assistant took too long to respond. Please try again.' };
      }
      console.warn('[CrewAI]', err.message);
      return { error: 'Could not reach AI service.' };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /** Answer a support/FAQ question using Crew knowledge base */
    search: (question) => call('search', question),

    /** Generate a 2-sentence job description from brief details */
    jobDescription: (details) => call('job-description', details),

    /** Summarise a block of text to 1-2 sentences */
    summarise: (text) => call('summarise', text),

    /** Generate push notification copy for a job event */
    notification: (event) => call('notification', event),

    /** Suggest service category tags for a job description */
    suggestTags: (description) => call('suggest-tags', description),
  };
})();

if (typeof module !== 'undefined') module.exports = CrewAI;
