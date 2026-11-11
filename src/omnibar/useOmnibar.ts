// The one box's conversation: the current case's messages (see useCases). Every Send goes to the
// assistant (see conversation.ts). A reply that comes after a switch still lands in its own case.
import { useCallback, useMemo, useRef, useState } from 'react';

import type { Assistant } from '../contracts/assistant';
import type { CaseMessage, CaseThread } from '../contracts/cases';
import { logFault } from '../diag/faultStore';
import type { Library } from '../features/library/useLibrary';
import { DraftState, NewMessage, OmniMessage, sendTurn } from './conversation';
import { Draft, draftToChange } from './validate';

export type { DraftState, OmniMessage } from './conversation';

function nextId(list: CaseMessage[]): number {
  return list.reduce((max, m) => Math.max(max, m.id), 0) + 1;
}

export function useOmnibar(lib: Library, assistant: Assistant, thread: CaseThread) {
  // Cases waiting for an answer, so each case has its own "Thinking…".
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const update = useRef(thread.update);
  update.current = thread.update;
  const caseId = thread.id;
  // Messages in a case were checked against the library when they arrived (OneBox checks ids again).
  const messages = thread.messages as OmniMessage[];
  const busy = caseId !== null && busyIds.includes(caseId);
  const deptId = lib.deptId;

  const staff = useMemo(() => lib.data.cards.filter((c) => c.department_id === deptId).map((c) => c.surgeon), [lib.data.cards, deptId]);
  const myDeptIds = useMemo(() => lib.mine.map((m) => m.department.id), [lib.mine]);

  /** Returns false when nothing was sent, so the box keeps the text. */
  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      if (caseId === null || busy) return false;
      const add = (m: NewMessage) => update.current(caseId, (prev) => [...prev, { ...m, id: nextId(prev) }]);
      setBusyIds((ids) => [...ids, caseId]);
      try {
        return await sendTurn(raw, { deptId, offline: lib.offline, staff, history: messages, data: lib.data, myDeptIds }, assistant, add);
      } finally {
        setBusyIds((ids) => ids.filter((id) => id !== caseId));
      }
    },
    [assistant, busy, caseId, deptId, lib.data, lib.offline, messages, myDeptIds, staff],
  );

  /** "Send for review": the draft becomes a normal suggestion; a colleague still has to approve it. */
  const sendDraft = useCallback(
    async (msgId: number, index: number, draft: Draft) => {
      if (!deptId || caseId === null) return;
      const setDraft = (state: DraftState, error?: string) =>
        update.current(caseId, (prev) => prev.map((m) => (m.id === msgId ? { ...m, drafts: { ...m.drafts, [index]: { state, error } } } : m)));
      const change = draftToChange(draft, lib.data, deptId);
      if (!change) {
        setDraft('error', 'This no longer matches the library. Ask again.');
        return;
      }
      setDraft('sending');
      try {
        await lib.propose(change);
        setDraft('sent');
      } catch (e) {
        logFault('omnibar', e);
        setDraft('error', e instanceof Error ? e.message : String(e));
      }
    },
    [caseId, deptId, lib],
  );

  return { messages, busy, send, sendDraft };
}

export type Omnibar = ReturnType<typeof useOmnibar>;
