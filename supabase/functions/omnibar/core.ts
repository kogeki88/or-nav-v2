// The AI calls behind the omnibar: Claude first, then a free backup (Groq) when Claude cannot answer.
// No Deno or Supabase code here, so it can be tested from a PC.
import type Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';

import { ANSWER_SCHEMA, type Engine, type OmniAnswer, type OmniTurn } from './schema.ts';
import { SYSTEM_PROMPT } from './prompt.ts';

export const DEFAULT_MODEL = 'claude-haiku-5-5';
export const DEFAULT_BACKUP_MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** caseNote: the case line (see prompt.ts). It goes after the cached library, so a case change keeps the cache. */
export type AskOpts = { context: string; caseNote?: string; history: OmniTurn[]; message: string };
export type Ask = (opts: AskOpts) => Promise<OmniAnswer>;

const NOT_UNDERSTOOD: OmniAnswer = { reply: 'Sorry, I could not understand that. Try saying it another way.', actions: [] };

/** The model's JSON text → an answer. Bad JSON becomes a plain "could not understand". */
export function parseAnswer(text: string): OmniAnswer {
  try {
    const parsed = JSON.parse(text) as OmniAnswer;
    return { reply: String(parsed.reply ?? ''), actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
  } catch {
    return NOT_UNDERSTOOD;
  }
}

export async function askClaude(client: Anthropic, model: string, opts: AskOpts): Promise<OmniAnswer> {
  const messages: Anthropic.MessageParam[] = [
    ...opts.history.map((t) => ({ role: t.role, content: t.text }) as Anthropic.MessageParam),
    { role: 'user', content: opts.message },
  ];
  const response = await client.messages.create({
    model,
    max_tokens: 4096, // answers are short; the cap keeps a runaway answer cheap
    system: [
      { type: 'text', text: SYSTEM_PROMPT },
      // The library changes rarely, so it is cached between messages.
      { type: 'text', text: opts.context, cache_control: { type: 'ephemeral' } },
      ...(opts.caseNote ? [{ type: 'text' as const, text: opts.caseNote }] : []),
    ],
    messages,
    output_config: { format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
  });

  if (response.stop_reason === 'refusal') return { reply: "I can't help with that one.", actions: [] };
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
  return parseAnswer(text);
}

/** The Groq request body (OpenAI-style chat with a strict JSON schema). Exported for tests. */
export function groqBody(model: string, opts: AskOpts) {
  return {
    model,
    messages: [
      { role: 'system', content: [SYSTEM_PROMPT, opts.context, opts.caseNote].filter(Boolean).join('\n\n') },
      ...opts.history.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user', content: opts.message },
    ],
    max_completion_tokens: 8192, // the backup model thinks before answering; thinking counts here
    response_format: { type: 'json_schema', json_schema: { name: 'omnibar_answer', strict: true, schema: ANSWER_SCHEMA } },
  };
}

/** The free backup. Plain fetch: no extra library on the server. */
export async function askGroq(
  apiKey: string,
  model: string,
  opts: AskOpts,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 20_000,
): Promise<OmniAnswer> {
  const res = await fetchFn(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(groqBody(model, opts)),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`backup status ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return parseAnswer(data.choices?.[0]?.message?.content ?? '');
}

/**
 * Claude first; on ANY failure (no key, out of credit, busy, rate limit, down, timeout) the backup gets the
 * same request. Throws only when both fail or neither is set up. `log` receives engine names, never text.
 */
export async function answerWithFallback(
  primary: Ask | null,
  backup: Ask | null,
  opts: AskOpts,
  log: (event: string) => void = () => {},
): Promise<{ answer: OmniAnswer; engine: Engine }> {
  if (primary) {
    try {
      const answer = await primary(opts);
      log('claude ok');
      return { answer, engine: 'claude' };
    } catch (e) {
      log(`claude failed${statusOf(e)}`);
    }
  } else {
    log('claude not set up');
  }
  if (!backup) throw new Error('no engine answered');
  try {
    const answer = await backup(opts);
    log('backup ok');
    return { answer, engine: 'backup' };
  } catch (e) {
    log(`backup failed${statusOf(e)}`);
    throw new Error('no engine answered');
  }
}

function statusOf(e: unknown): string {
  const status = (e as { status?: unknown })?.status;
  if (typeof status === 'number') return ` (${status})`;
  const msg = e instanceof Error ? e.message : '';
  const m = /status (\d{3})/.exec(msg);
  return m ? ` (${m[1]})` : e instanceof Error && e.name === 'TimeoutError' ? ' (timeout)' : '';
}
