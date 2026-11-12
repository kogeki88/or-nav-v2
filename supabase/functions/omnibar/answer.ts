// Checks a model's answer text against ANSWER_SCHEMA. Some models cannot be forced into the schema
// (they only get the JSON rules in the prompt), so every answer is checked here. A broken answer is null,
// and the server then tries the next model. Pure TypeScript: no Deno code, so Jest can test it.
import { ANSWER_SCHEMA, type OmniAnswer } from './schema.ts';

type Schema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  anyOf?: Schema[];
};

function typeOk(t: string, v: unknown): boolean {
  switch (t) {
    case 'null': return v === null;
    case 'string': return typeof v === 'string';
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'array': return Array.isArray(v);
    case 'object': return typeof v === 'object' && v !== null && !Array.isArray(v);
    default: return false;
  }
}

/** True when the value fits the schema. Covers only the parts ANSWER_SCHEMA uses. */
function fits(s: Schema, v: unknown): boolean {
  if (s.anyOf) return s.anyOf.some((sub) => fits(sub, v));
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => typeOk(t, v))) return false;
  }
  if (s.enum && !s.enum.includes(v)) return false;
  if (Array.isArray(v)) return !s.items || v.every((x) => fits(s.items!, x));
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    const props = s.properties ?? {};
    if ((s.required ?? []).some((k) => !(k in o))) return false;
    if (s.additionalProperties === false && Object.keys(o).some((k) => !(k in props))) return false;
    return Object.entries(o).every(([k, x]) => !props[k] || fits(props[k], x));
  }
  return true;
}

/** The JSON object in the text: the whole text, a ```json fence, or from the first "{" to the last "}". */
function extractJson(text: string): unknown {
  const tries = [text.trim()];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) tries.push(fence[1].trim());
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) tries.push(text.slice(start, end + 1));
  for (const t of tries) {
    try {
      return JSON.parse(t);
    } catch {
      // try the next form
    }
  }
  return undefined;
}

/** The prompt shows ids as "item:<id>", "card:<id>", "line:<id>", "dept:<id>"; models often copy the label. */
const ID_LABEL = /^(?:item|card|line|dept):/;
const unlabel = (v: unknown) => (typeof v === 'string' ? v.replace(ID_LABEL, '') : v);

function cleanIds(a: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (k === 'item_ids' || k === 'card_ids') out[k] = (v as unknown[]).map(unlabel);
    else out[k] = k.endsWith('_id') ? unlabel(v) : v;
  }
  return out;
}

/** The answer when the text holds JSON that matches ANSWER_SCHEMA; otherwise null (a failure). */
export function checkAnswer(text: string): OmniAnswer | null {
  const value = extractJson(text);
  if (value === undefined || !fits(ANSWER_SCHEMA as Schema, value)) return null;
  const answer = value as OmniAnswer;
  return { reply: answer.reply, actions: answer.actions.map((a) => cleanIds(a) as OmniAnswer['actions'][number]) };
}
