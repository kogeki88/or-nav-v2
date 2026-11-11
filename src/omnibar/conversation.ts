// One Send in the one box: checks, scrubs on the phone, then always asks the assistant. Offline it asks nothing.
// Plain TypeScript (Jest-tested); useOmnibar holds the messages.
import type { Assistant, AssistantTurn } from '../contracts/assistant';
import type { CaseDraftState, CaseMessage } from '../contracts/cases';
import type { LibraryData } from '../contracts/library';
import type { Engine, OmniAction } from '../../supabase/functions/omnibar/schema';
import { describeRemoved, scrub } from '../../supabase/functions/omnibar/scrub';
import { validActions } from './validate';

export type DraftState = CaseDraftState;

/** A case message (contracts/cases) whose actions were checked against the library. */
export type OmniMessage = Omit<CaseMessage, 'actions' | 'engine'> & {
  actions?: OmniAction[];
  /** Set when the free backup AI answered instead of Claude. */
  engine?: Engine;
};

export type NewMessage = Omit<OmniMessage, 'id'>;

export const OFFLINE_LINE = 'The AI needs internet. Your matches are still above.';
const NO_DEPARTMENT = 'Join a department first: open the sidebar, tap your name, then Department.';
const HISTORY_TURNS = 10;

export type TurnContext = {
  deptId: string | null;
  /** The library could not reach the server on its last load. */
  offline: boolean;
  /** Surgeon names on this department's cards, so the scrubber keeps them. */
  staff: string[];
  history: OmniMessage[];
  data: LibraryData;
  myDeptIds: string[];
};

/** Adds messages through `add` as they are ready. Returns true when the box can be cleared. */
export async function sendTurn(raw: string, ctx: TurnContext, assistant: Assistant, add: (m: NewMessage) => void): Promise<boolean> {
  const text = raw.trim();
  if (!text) return false;
  if (!ctx.deptId) {
    add({ role: 'assistant', text: NO_DEPARTMENT, tone: 'warn', local: true });
    return false;
  }
  if (ctx.offline) {
    add({ role: 'assistant', text: OFFLINE_LINE, tone: 'warn', local: true });
    return false;
  }

  const clean = scrub(text, ctx.staff);
  if (!clean.ok) {
    add({ role: 'assistant', text: clean.reason, tone: 'danger', note: 'Nothing was sent.', local: true });
    return false;
  }

  const history: AssistantTurn[] = ctx.history
    .filter((m) => !m.tone)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, text: m.text }));
  add({ role: 'user', text: clean.text, note: clean.removed.length ? `Removed for privacy: ${describeRemoved(clean.removed)}.` : undefined });

  const reply = await assistant.ask({ message: clean.text, history, department_id: ctx.deptId });
  if (reply.kind === 'offline') {
    add({ role: 'assistant', text: OFFLINE_LINE, tone: 'warn', local: true });
  } else if (reply.kind === 'error') {
    add({ role: 'assistant', text: reply.message, tone: 'danger' });
  } else {
    const objects = reply.actions.filter((a): a is OmniAction => typeof a === 'object' && a !== null);
    const actions = validActions(objects, ctx.data, ctx.deptId, ctx.myDeptIds);
    const drafts: OmniMessage['drafts'] = {};
    actions.forEach((a, i) => {
      if (a.type.startsWith('draft_')) drafts[i] = { state: 'ready' };
    });
    add({ role: 'assistant', text: reply.reply || 'Done.', actions, drafts, engine: reply.backup ? 'backup' : 'claude' });
  }
  return true;
}
