import { describe, expect, it } from '@jest/globals';

import { BUSY, MODELS, answerWithFallback, askOpenRouter, openRouterBody, type AskOpts, type ModelAsk } from './core';
import { JSON_RULES, SYSTEM_PROMPT } from './prompt';

const base: AskOpts = { context: 'LIBRARY', history: [], message: 'closure?' };
const good = { reply: 'Bovie pencil is at A1 / Bin 1.', actions: [] };

describe('the model order', () => {
  it('is Nemotron Ultra (free) first, then Claude Haiku (paid) last', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['nvidia/nemotron-3-ultra-550b-a55b:free', 'anthropic/claude-haiku-5.5']);
    expect(MODELS.map((m) => m.label)).toEqual(['Nemotron Ultra', 'Claude Haiku']);
  });
});

describe('the OpenRouter request', () => {
  it('sends the prompt, the JSON rules and the library as one system message', () => {
    expect(openRouterBody('m', base).messages[0].content).toBe(`${SYSTEM_PROMPT}\n\n${JSON_RULES}\n\nLIBRARY`);
  });

  it('puts the case line after the library', () => {
    expect(openRouterBody('m', { ...base, caseNote: 'CASE' }).messages[0].content).toBe(`${SYSTEM_PROMPT}\n\n${JSON_RULES}\n\nLIBRARY\n\nCASE`);
  });

  // Earlier replies go back in the answer format: plain-text replies in the history made models answer in plain text.
  it('sends the history, then the message, with earlier replies in the answer format', () => {
    const body = openRouterBody('m', { ...base, history: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello "nurse"' }] });
    expect(body.model).toBe('m');
    expect(body.messages.slice(1)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '{"reply":"hello \\"nurse\\"","actions":[]}' },
      { role: 'user', content: 'closure?' },
    ]);
  });
});

/** A fake fetch that answers with this status and body. */
const fakeFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const content = (text: string) => ({ choices: [{ message: { content: text } }] });

describe('one model answer', () => {
  it('gives the checked answer', async () => {
    await expect(askOpenRouter('key', 'm', base, fakeFetch(200, content(JSON.stringify(good))))).resolves.toEqual(good);
  });

  it('fails on an error status, with the status in the error', async () => {
    await expect(askOpenRouter('key', 'm', base, fakeFetch(429, { error: { message: 'rate limited' } }))).rejects.toThrow('status 429');
  });

  it('fails on an error inside a 200 answer', async () => {
    await expect(askOpenRouter('key', 'm', base, fakeFetch(200, { error: { message: 'upstream down', code: 502 } }))).rejects.toThrow('status 502');
  });

  it('fails on broken JSON', async () => {
    const broken = '{"reply":"Moved."},{"actions":[]}}';
    await expect(askOpenRouter('key', 'm', base, fakeFetch(200, content(broken)))).rejects.toThrow('bad answer');
  });

  it('fails on a timeout', async () => {
    const slow = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    await expect(askOpenRouter('key', 'm', base, slow, 10)).rejects.toThrow();
  });
});

/** A fake ask: each model id gives an answer or throws this error. */
function fakeAsk(results: Record<string, OmniAnswerOrError>) {
  const asked: string[] = [];
  const ask: ModelAsk = async (modelId) => {
    asked.push(modelId);
    const r = results[modelId];
    if (r instanceof Error) throw r;
    return r;
  };
  return { ask, asked };
}
type OmniAnswerOrError = typeof good | Error;

const timeout = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });

describe('the fallback', () => {
  const [ultra, haiku] = MODELS;

  it('uses the first model when it answers, and asks no other', async () => {
    const { ask, asked } = fakeAsk({ [ultra.id]: good, [haiku.id]: good });
    await expect(answerWithFallback(MODELS, ask, base)).resolves.toEqual({ answer: good, model: 'Nemotron Ultra' });
    expect(asked).toEqual([ultra.id]);
  });

  it.each([
    ['an error status', new Error('status 500')],
    ['a rate limit', new Error('status 429')],
    ['a timeout', timeout],
    ['broken JSON', new Error('bad answer')],
  ])('moves to the next model on %s', async (_name, failure) => {
    const { ask, asked } = fakeAsk({ [ultra.id]: failure, [haiku.id]: good });
    await expect(answerWithFallback(MODELS, ask, base)).resolves.toEqual({ answer: good, model: 'Claude Haiku' });
    expect(asked).toEqual([ultra.id, haiku.id]);
  });

  it('says the assistant is busy when every model fails', async () => {
    const { ask } = fakeAsk({ [ultra.id]: new Error('status 429'), [haiku.id]: timeout });
    await expect(answerWithFallback(MODELS, ask, base)).rejects.toThrow(BUSY);
    expect(BUSY).toMatch(/busy.*try again/i);
  });

  it('logs model names and failure kinds, never the message text', async () => {
    const secret = 'needs extra mesh for the hernia';
    const logs: string[] = [];
    const { ask } = fakeAsk({ [ultra.id]: new Error(`status 400: ${secret}`), [haiku.id]: good });
    await answerWithFallback(MODELS, ask, { ...base, message: secret }, (e) => logs.push(e));
    expect(logs).toEqual(['Nemotron Ultra failed (400)', 'Claude Haiku ok']);
    expect(logs.join(' ')).not.toContain('mesh');
  });

  it('logs a timeout and a broken answer by name', async () => {
    const logs: string[] = [];
    const { ask } = fakeAsk({ [ultra.id]: timeout, [haiku.id]: new Error('bad answer') });
    await answerWithFallback(MODELS, ask, base, (e) => logs.push(e)).catch(() => {});
    expect(logs).toEqual(['Nemotron Ultra failed (timeout)', 'Claude Haiku failed (bad answer)']);
  });
});
