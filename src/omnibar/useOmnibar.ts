// The one box's conversation, in memory only: every Send goes to the assistant (see conversation.ts).
import { useCallback, useMemo, useRef, useState } from 'react';

import type { Assistant } from '../contracts/assistant';
import { logFault } from '../diag/faultStore';
import type { Library } from '../features/library/useLibrary';
import { DraftState, NewMessage, OmniMessage, sendTurn } from './conversation';
import { Draft, draftToChange } from './validate';

export type { DraftState, OmniMessage } from './conversation';

export function useOmnibar(lib: Library, assistant: Assistant) {
  const [messages, setMessages] = useState<OmniMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const deptId = lib.deptId;

  const staff = useMemo(() => lib.data.cards.filter((c) => c.department_id === deptId).map((c) => c.surgeon), [lib.data.cards, deptId]);
  const myDeptIds = useMemo(() => lib.mine.map((m) => m.department.id), [lib.mine]);

  const add = useCallback((m: NewMessage) => {
    const msg = { ...m, id: nextId.current++ };
    setMessages((prev) => [...prev, msg]);
  }, []);

  /** Returns false when nothing was sent, so the box keeps the text. */
  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      if (busy) return false;
      setBusy(true);
      try {
        return await sendTurn(raw, { deptId, offline: lib.offline, staff, history: messages, data: lib.data, myDeptIds }, assistant, add);
      } finally {
        setBusy(false);
      }
    },
    [add, assistant, busy, deptId, lib.data, lib.offline, messages, myDeptIds, staff],
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
        logFault('omnibar', e);
        setDraft(msgId, index, 'error', e instanceof Error ? e.message : String(e));
      }
    },
    [deptId, lib, setDraft],
  );

  const clear = useCallback(() => setMessages([]), []);

  return { messages, busy, send, sendDraft, clear };
}

export type Omnibar = ReturnType<typeof useOmnibar>;
