// The one Claude call behind the omnibar. No Deno or Supabase code here, so it can be tested from a PC.
import type Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';

import { ANSWER_SCHEMA, type OmniAnswer, type OmniTurn } from './schema.ts';
import { SYSTEM_PROMPT } from './prompt.ts';

export const DEFAULT_MODEL = 'claude-haiku-5-5';

export async function askClaude(
  client: Anthropic,
  opts: { model: string; context: string; history: OmniTurn[]; message: string },
): Promise<OmniAnswer> {
  const messages: Anthropic.MessageParam[] = [
    ...opts.history.map((t) => ({ role: t.role, content: t.text }) as Anthropic.MessageParam),
    { role: 'user', content: opts.message },
  ];
  const response = await client.messages.create({
    model: opts.model,
    max_tokens: 4096, // answers are short; the cap keeps a runaway answer cheap
    system: [
      { type: 'text', text: SYSTEM_PROMPT },
      // The library changes rarely, so it is cached between messages.
      { type: 'text', text: opts.context, cache_control: { type: 'ephemeral' } },
    ],
    messages,
    output_config: { format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
  });

  if (response.stop_reason === 'refusal') return { reply: "I can't help with that one.", actions: [] };
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
  try {
    const parsed = JSON.parse(text) as OmniAnswer;
    return { reply: String(parsed.reply ?? ''), actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
  } catch {
    return { reply: 'Sorry, I could not understand that. Try saying it another way.', actions: [] };
  }
}
