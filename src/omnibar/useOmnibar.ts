// Chat state for the omnibar: scrub on the phone, ask the server (or plain search offline), check the answer.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { useCallback, useMemo, useRef, useState } from 'react';

import { supabase } from '../auth/supabase';
import type { Library } from '../library/useLibrary';
import type { Engine, OmniAction, OmniTurn } from '../../supabase/functions/omnibar/schema';
import { describeRemoved, scrub } from '../../supabase/functions/omnibar/scrub';
import { Draft, draftToChange, localAnswer, validActions } from './validate';

export type DraftState = 'ready' | 'sending' | 'sent' | 'error';

export type OmniMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** Under a user message: what the scrubber removed. Under an answer: offline or error notes. */
  note?: string;
  tone?: 'warn' | 'danger';
  actions?: OmniAction[];
  drafts?: Record<number, { state: DraftState; error?: string }>;
  /** Set when the free backup AI answered instead of Claude. */
  engine?: Engine;
};

const HISTORY_TURNS = 10;

export function useOmnibar(lib: Library) {
  const [messages, setMessages] = useState<OmniMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const deptId = lib.deptId;

  const staff = useMemo(() => lib.data.cards.filter((c) => c.department_id === deptId).map((c) => c.surgeon), [lib.data.cards, deptId]);
  const myDeptIds = useMemo(() => lib.mine.map((m) => m.department.id), [lib.mine]);

  const add = useCallback((m: Omit<OmniMessage, 'id'>) => {
    const msg = { ...m, id: nextId.current++ };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  }, []);

  /** Returns false when the message was blocked, so the box keeps the text for editing. */
  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim();
      if (!text || busy) return false;
      if (!deptId) {
        add({ role: 'assistant', text: 'Join a department first, in the Library tab.', tone: 'warn' });
        return true;
      }

      const clean = scrub(text, staff);
      if (!clean.ok) {
        add({ role: 'assistant', text: clean.reason, tone: 'danger', note: 'Nothing was sent.' });
        return false;
      }

      const history: OmniTurn[] = messages
        .filter((m) => !m.tone)
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, text: m.text }));
      add({ role: 'user', text: clean.text, note: clean.removed.length ? `Removed for privacy: ${describeRemoved(clean.removed)}.` : undefined });

      const offline = (note: string) => {
        const a = localAnswer(clean.text, lib.data, deptId);
        add({ role: 'assistant', text: a.reply, actions: a.actions, note, tone: 'warn' });
      };

      if (lib.offline) {
        offline('Offline');
        return true;
      }

      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke('omnibar', {
          body: { message: clean.text, history, department_id: deptId },
        });
        if (error) {
          if (error instanceof FunctionsHttpError) {
            let msg = 'The assistant could not answer. Try again.';
            try {
              const body = await error.context.json();
              if (body?.error) msg = String(body.error);
            } catch {
              // keep the plain message
            }
            add({ role: 'assistant', text: msg, tone: 'danger' });
          } else if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
            offline('No connection to the assistant');
          } else {
            add({ role: 'assistant', text: 'The assistant could not answer. Try again.', tone: 'danger' });
          }
          return true;
        }
        const reply = String(data?.reply ?? '');
        const actions = validActions(Array.isArray(data?.actions) ? data.actions : [], lib.data, deptId, myDeptIds);
        const drafts: OmniMessage['drafts'] = {};
        actions.forEach((a, i) => {
          if (a.type.startsWith('draft_')) drafts[i] = { state: 'ready' };
        });
        add({ role: 'assistant', text: reply || 'Done.', actions, drafts, engine: data?.engine === 'backup' ? 'backup' : 'claude' });
      } catch {
        offline('No connection to the assistant');
      } finally {
        setBusy(false);
      }
      return true;
    },
    [add, busy, deptId, lib.data, lib.offline, messages, myDeptIds, staff],
  );

  const setDraft = useCallback((msgId: number, index: number, state: DraftState, error?: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, drafts: { ...m.drafts, [index]: { state, error } } } : m)));
  }, []);

  /** "Send for review": the draft becomes a normal suggestion; a colleague still has to approve it. */
  const sendDraft = useCallback(
    async (msgId: number, index: number, draft: Draft) => {
      if (!deptId) return;
      const change = draftToChange(draft, lib.data, deptId);
      if (!change) {
        setDraft(msgId, index, 'error', 'This no longer matches the library. Ask again.');
        return;
      }
      setDraft(msgId, index, 'sending');
      try {
        await lib.propose(change);
        setDraft(msgId, index, 'sent');
      } catch (e) {
        setDraft(msgId, index, 'error', e instanceof Error ? e.message : String(e));
      }
    },
    [deptId, lib, setDraft],
  );

  const clear = useCallback(() => setMessages([]), []);

  return { messages, busy, send, sendDraft, clear };
}

export type Omnibar = ReturnType<typeof useOmnibar>;
