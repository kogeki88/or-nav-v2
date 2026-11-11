// Supabase Edge Function "omnibar": the only place the AI keys are used (Anthropic, and the free Groq backup).
// Steps: signed-in user → member of the department → scrub again → daily limit → load library (as the user)
// → Claude, or the backup when Claude cannot answer.
// Privacy: never log message text. Logs hold only event names and counts.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

import { scrub } from './scrub.ts';
import { UUID, type OmniRequest, type OmniTurn } from './schema.ts';
import { DEFAULT_BACKUP_MODEL, DEFAULT_MODEL, answerWithFallback, askClaude, askGroq, type Ask } from './core.ts';
import { caseNote, libraryContext, readCase } from './prompt.ts';

const DAILY_LIMIT = Number(Deno.env.get('OMNIBAR_DAILY_LIMIT') ?? '50');
const MODEL = Deno.env.get('OMNIBAR_MODEL') ?? DEFAULT_MODEL;
const BACKUP_MODEL = Deno.env.get('OMNIBAR_BACKUP_MODEL') ?? DEFAULT_BACKUP_MODEL;
const MAX_MESSAGE = 1000;
const MAX_HISTORY = 10;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, error: string) => json(status, { error });

/** The project's public key: the new publishable key ("default"), or the legacy anon key. Never the secret key. */
function publicKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
    if (keys.default) return keys.default;
  } catch {
    // fall through to the legacy key
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? '';
}

function readBody(raw: unknown): OmniRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.message !== 'string' || !b.message.trim() || b.message.length > MAX_MESSAGE) return null;
  if (typeof b.department_id !== 'string' || !UUID.test(b.department_id)) return null;
  const history = Array.isArray(b.history) ? b.history : [];
  const turns: OmniTurn[] = [];
  for (const t of history.slice(-MAX_HISTORY)) {
    if (t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string' && t.text.length <= 4000) {
      turns.push({ role: t.role, text: t.text });
    }
  }
  // `case` is optional: old app versions do not send it, and an odd one is dropped, not refused.
  return { message: b.message, history: turns, department_id: b.department_id, case: readCase(b.case) };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'Use POST.');
  const auth = req.headers.get('Authorization');
  if (!auth) return fail(401, 'Sign in first.');

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!anthropicKey && !groqKey) {
    console.error('omnibar: no AI key is set');
    return fail(503, 'The assistant is not set up yet.');
  }

  // Acts as the signed-in user, so row-level security limits what can be read.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publicKey(), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (userError || !userData.user) return fail(401, 'Sign in again.');
  const userId = userData.user.id;

  let body: OmniRequest | null = null;
  try {
    body = readBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return fail(400, 'That message could not be read.');

  const { data: memberships, error: memError } = await supabase
    .from('memberships')
    .select('department_id, departments(name, hospitals(name))')
    .eq('user_id', userId);
  if (memError) return fail(500, 'Could not check your departments.');
  type MembershipRow = { department_id: string; departments: { name: string; hospitals: { name: string } | null } | null };
  const mine = (memberships ?? []) as unknown as MembershipRow[];
  const current = mine.find((m) => m.department_id === body!.department_id);
  if (!current) return fail(403, "You're not a member of that department.");

  const [items, cards, cardItems] = await Promise.all([
    supabase.from('items').select('id,name,category,shelf,sub_location,synonyms,notes').eq('department_id', body.department_id),
    supabase.from('preference_cards').select('id,surgeon,procedure,specialty,notes').eq('department_id', body.department_id),
    supabase.from('card_items').select('id,card_id,item_id,phase,quantity,open_or_hold,note,sort_order').eq('department_id', body.department_id),
  ]);
  if (items.error || cards.error || cardItems.error) return fail(500, 'Could not load the library.');

  // Second scrub, with the same rules as the phone. Staff (surgeon) names are allowed.
  const staff = (cards.data ?? []).map((c) => String(c.surgeon));
  const clean = scrub(body.message, staff);
  if (!clean.ok) {
    console.log('omnibar: blocked by scrubber');
    return fail(422, clean.reason);
  }
  const history: OmniTurn[] = [];
  for (const t of body.history) {
    if (t.role === 'assistant') {
      history.push(t);
      continue;
    }
    const s = scrub(t.text, staff);
    if (s.ok) history.push({ role: 'user', text: s.text });
  }
  // Claude needs turns that alternate user/assistant, starting with the user.
  while (history.length && history[0].role !== 'user') history.shift();
  const alternating = history.filter((t, i) => i === 0 || t.role !== history[i - 1].role);
  if (alternating.length && alternating[alternating.length - 1].role === 'user') alternating.pop();

  const { error: quotaError } = await supabase.rpc('use_ai_quota', { p_limit: DAILY_LIMIT });
  if (quotaError) {
    if (/daily limit/i.test(quotaError.message)) return fail(429, `You've used today's ${DAILY_LIMIT} assistant messages. Search still works.`);
    return fail(500, 'Could not check the daily limit.');
  }

  const label = (m: MembershipRow) => [m.departments?.hospitals?.name, m.departments?.name].filter(Boolean).join(' · ');
  const context = libraryContext({
    departmentName: label(current),
    myDepartments: mine.map((m) => ({ id: m.department_id, label: label(m) })),
    items: items.data ?? [],
    cards: cards.data ?? [],
    cardItems: cardItems.data ?? [],
  });

  // Claude fails fast (one retry, 20 s) so the backup still answers within a nurse's patience.
  const claude: Ask | null = anthropicKey
    ? (o) => askClaude(new Anthropic({ apiKey: anthropicKey, maxRetries: 1, timeout: 20_000 }), MODEL, o)
    : null;
  const backup: Ask | null = groqKey ? (o) => askGroq(groqKey, BACKUP_MODEL, o) : null;

  try {
    // The case's card must be one of this department's cards; any other card_id is ignored.
    const note = caseNote(body.case, cards.data ?? []);
    const opts = { context, caseNote: note, history: alternating, message: clean.text };
    const { answer, engine } = await answerWithFallback(claude, backup, opts, (event) => console.log(`omnibar: ${event}`));
    console.log(`omnibar: ${engine}, ${answer.actions.length} actions`);
    return json(200, { ...answer, engine, removed: clean.removed });
  } catch {
    return fail(502, 'The assistant is not answering right now. Search still works.');
  }
});
