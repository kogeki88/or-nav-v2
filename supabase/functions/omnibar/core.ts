// The AI calls behind the omnibar, all through OpenRouter: the models are tried in order, free first.
// No Deno or Supabase code here, so it can be tested from a PC.
import { checkAnswer } from './answer.ts';
import type { OmniAnswer, OmniTurn } from './schema.ts';
import { JSON_RULES, SYSTEM_PROMPT } from './prompt.ts';

/**
 * The order Sean picked after the ticket #25 test (qa/25/compare-models.html): Nemotron Ultra is free and
 * answered 14 of 14; Claude Haiku is paid (about $0.0007 a message) and answers only when Ultra cannot.
 * The label is what the nurse sees on each answer.
 */
export const MODELS = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron Ultra' },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku' },
] as const;
export type Model = { id: string; label: string };

/** What the nurse reads when no model answered. */
export const BUSY = 'The assistant is busy. Try again in a moment. Search still works.';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** caseNote: the case line (see prompt.ts), after the library. */
export type AskOpts = { context: string; caseNote?: string; history: OmniTurn[]; message: string };
/** Asks one model; throws when it fails or its answer is broken. */
export type ModelAsk = (modelId: string, opts: AskOpts) => Promise<OmniAnswer>;

/** The OpenRouter request body. No forced schema (Anthropic refuses ours); the JSON rules are in the prompt. */
export function openRouterBody(model: string, opts: AskOpts) {
  return {
    model,
    messages: [
      { role: 'system', content: [SYSTEM_PROMPT, JSON_RULES, opts.context, opts.caseNote].filter(Boolean).join('\n\n') },
      ...opts.history.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user', content: opts.message },
    ],
    max_tokens: 8192, // Nemotron thinks before answering, and thinking counts here
  };
}

/** One model. Throws "status N", a TimeoutError, or "bad answer" (JSON that does not match the schema). */
export async function askOpenRouter(
  apiKey: string,
  model: string,
  opts: AskOpts,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 20_000,
): Promise<OmniAnswer> {
  const res = await fetchFn(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'OR-Nav' },
    body: JSON.stringify(openRouterBody(model, opts)),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string | null } }[];
    error?: { code?: number };
  };
  if (!res.ok) throw new Error(`status ${res.status}`);
  if (data.error) throw new Error(`status ${data.error.code ?? 'error'}`);
  const answer = checkAnswer(data.choices?.[0]?.message?.content ?? '');
  if (!answer) throw new Error('bad answer');
  return answer;
}

/**
 * Tries each model in order; on ANY failure (error, rate limit, timeout, broken answer) the next model gets the
 * same request. Throws BUSY when all fail. `log` receives model names and failure kinds, never text.
 */
export async function answerWithFallback(
  models: readonly Model[],
  ask: ModelAsk,
  opts: AskOpts,
  log: (event: string) => void = () => {},
): Promise<{ answer: OmniAnswer; model: string }> {
  for (const m of models) {
    try {
      const answer = await ask(m.id, opts);
      log(`${m.label} ok`);
      return { answer, model: m.label };
    } catch (e) {
      log(`${m.label} failed (${failureKind(e)})`);
    }
  }
  throw new Error(BUSY);
}

/** A short failure kind for the log: a status number, "timeout", "bad answer" or "error". Never message text. */
function failureKind(e: unknown): string {
  if (e instanceof Error && e.name === 'TimeoutError') return 'timeout';
  const msg = e instanceof Error ? e.message : '';
  if (msg === 'bad answer') return 'bad answer';
  const m = /status (\d{3})/.exec(msg);
  return m ? m[1] : 'error';
}
