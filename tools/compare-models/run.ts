// Ticket #25, step 1: send the same OR questions to four OpenRouter models, side by side.
// Run from the repo root:  node tools/compare-models/run.ts
// Reads OPENROUTER_API_KEY from the jev .env file. Never prints or saves the key.
// Writes qa/25/results.json; then run page.ts to make the HTML page.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

import { JSON_RULES, SYSTEM_PROMPT, caseNote, libraryContext } from '../../supabase/functions/omnibar/prompt.ts';
import { checkAnswer } from '../../supabase/functions/omnibar/answer.ts';
import { scrub } from '../../supabase/functions/omnibar/scrub.ts';
import { validActions } from '../../src/omnibar/validate.ts';
import { library } from './library.ts';
import { QUESTIONS } from './questions.ts';

const ENV_FILE = 'C:/Users/igles/phone app/jev/.env';
const URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MODELS = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron Ultra' },
  { id: 'nvidia/nemotron-3.5-super-vl:free', label: 'Nemotron Super' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B' },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
];
const TIMEOUT_MS = 90_000;

function readKey(): string {
  const line = readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENROUTER_API_KEY='));
  const key = line?.slice('OPENROUTER_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  if (!key) throw new Error('OPENROUTER_API_KEY not found in the jev .env file');
  return key;
}

/** Removes anything that looks like a key, in case an error message echoes one. */
const safe = (s: string) => s.replace(/sk-or-[\w-]+/g, '[key]').slice(0, 400);

/** One retry after 10 s when a free model is rate-limited, so one busy moment does not decide the test. */
async function askWithRetry(key: string, model: string, system: string, message: string) {
  const first = await ask(key, model, system, message);
  if (!first.error || !/rate.?limit|429/i.test(first.error)) return { ...first, retried: false };
  await new Promise((r) => setTimeout(r, 10_000));
  return { ...(await ask(key, model, system, message)), retried: true };
}

async function ask(key: string, model: string, system: string, message: string) {
  const started = Date.now();
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'OR-Nav model test' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
        max_tokens: 8192,
        // No forced schema: Anthropic refuses ours (18 nullable fields, limit 16) and Nemotron Ultra cannot use one.
        // The prompt (JSON_RULES) asks for the format and checkAnswer tests every answer, the same for all models.
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - started;
    const data = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string | null } }[];
      usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number };
      provider?: string;
      error?: { message?: string; code?: number; metadata?: { raw?: unknown; provider_name?: string } };
    };
    if (!res.ok || data.error) {
      const raw = data.error?.metadata?.raw;
      const detail = raw ? ` | ${data.error?.metadata?.provider_name ?? ''}: ${typeof raw === 'string' ? raw : JSON.stringify(raw)}` : '';
      return { ms, status: res.status, error: safe((data.error?.message ?? `status ${res.status}`) + detail) };
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    return { ms, status: res.status, text, usage: data.usage, provider: data.provider };
  } catch (e) {
    const err = e as Error;
    return { ms: Date.now() - started, error: err.name === 'TimeoutError' ? `timeout after ${TIMEOUT_MS / 1000} s` : safe(err.message) };
  }
}

async function main() {
  const key = readKey();
  const context = libraryContext(library.contextInput);
  const staff = library.data.cards.map((c) => c.surgeon);
  const results = [];

  // ONLY=3 runs only the first 3 questions (a quick check).
  const only = Number(process.env.ONLY ?? QUESTIONS.length);
  for (const [n, q] of QUESTIONS.slice(0, only).entries()) {
    const clean = scrub(q.text, staff);
    if (!clean.ok || q.mustBlock) {
      // The patient-info question must be stopped here and never sent.
      results.push({ n: n + 1, ...q, blocked: !clean.ok, blockReason: clean.ok ? null : clean.reason, answers: [] });
      console.log(`Q${n + 1}: ${clean.ok ? 'NOT blocked (scrubber missed it; not sent)' : 'blocked by the scrubber, not sent'}`);
      continue;
    }
    const note = q.caseCardProcedure
      ? caseNote(
          { surgeon: null, procedure: null, card_id: library.data.cards.find((c) => c.procedure === q.caseCardProcedure)!.id },
          library.data.cards,
        )
      : '';
    const system = [SYSTEM_PROMPT, JSON_RULES, context, note].filter(Boolean).join('\n\n');
    const answers = await Promise.all(
      MODELS.map(async (m) => {
        const r = await askWithRetry(key, m.id, system, clean.text);
        const answer = r.text !== undefined ? checkAnswer(r.text) : null;
        const kept = answer ? validActions(answer.actions, library.data, library.deptId, library.myDeptIds) : [];
        return {
          model: m.id,
          label: m.label,
          ms: r.ms,
          retried: r.retried,
          error: r.error ?? null,
          provider: r.provider ?? null,
          cost: r.usage?.cost ?? null,
          tokensIn: r.usage?.prompt_tokens ?? null,
          tokensOut: r.usage?.completion_tokens ?? null,
          formatOk: !!answer,
          raw: answer ? null : (r.text ?? '').slice(0, 600),
          reply: answer?.reply ?? null,
          actions: answer?.actions ?? [],
          actionsKept: kept.length,
        };
      }),
    );
    console.log(`Q${n + 1}: ` + answers.map((a) => `${a.label} ${a.error ? 'ERR' : a.formatOk ? 'ok' : 'BAD'} ${(a.ms / 1000).toFixed(1)}s`).join(' | '));
    results.push({ n: n + 1, ...q, blocked: false, answers });
  }

  mkdirSync('qa/25', { recursive: true });
  writeFileSync('qa/25/results.json', JSON.stringify({ ranAt: new Date().toISOString(), models: MODELS, results }, null, 2));
  console.log('Saved qa/25/results.json');
}

await main();
