// Send in the one box: it always asks the assistant, and offline it asks nothing.
import { describe, expect, it } from '@jest/globals';

import type { Assistant, AssistantReply, AssistantRequest } from '../contracts/assistant';
import type { Card, Item, LibraryData } from '../contracts/library';
import { NewMessage, OFFLINE_LINE, TurnContext, sendTurn } from './conversation';

const bovie: Item = { id: 'i-bovie', department_id: 'd1', name: 'Bovie pencil', category: null, shelf: 'A1', sub_location: 'Bin 1', synonyms: [], notes: null, photo_path: null, version: 1 };
const lap: Card = { id: 'c-lap', department_id: 'd1', surgeon: 'Avery', procedure: 'Lap chole', specialty: null, notes: null, version: 1 };
const data: LibraryData = { hospitals: [], departments: [], memberships: [], items: [bovie], cards: [lap], cardItems: [], requests: [], loadedAt: '' };

/** A fake assistant that remembers every call. */
function fakeAssistant(reply: AssistantReply = { kind: 'answer', reply: 'A1, bin 1.', actions: [{ type: 'open_item', item_id: 'i-bovie' }], backup: false }) {
  const calls: AssistantRequest[] = [];
  const assistant: Assistant = {
    ask: async (req) => {
      calls.push(req);
      return reply;
    },
  };
  return { assistant, calls };
}

function context(patch: Partial<TurnContext> = {}): TurnContext {
  return { deptId: 'd1', offline: false, staff: ['Avery'], history: [], data, myDeptIds: ['d1'], ...patch };
}

async function run(text: string, ctx: TurnContext, assistant: Assistant) {
  const added: NewMessage[] = [];
  const sent = await sendTurn(text, ctx, assistant, (m) => added.push(m));
  return { sent, added };
}

describe('sendTurn', () => {
  it('sends a plain item word to the assistant (no guessing between item and question)', async () => {
    const { assistant, calls } = fakeAssistant();
    const { sent, added } = await run('bovie', context(), assistant);
    expect(calls).toEqual([{ message: 'bovie', history: [], department_id: 'd1' }]);
    expect(sent).toBe(true);
    expect(added.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(added[1]).toMatchObject({ text: 'A1, bin 1.', actions: [{ type: 'open_item', item_id: 'i-bovie' }] });
  });

  it('sends a question to the assistant too', async () => {
    const { assistant, calls } = fakeAssistant();
    await run('does avery want the endo bag open?', context(), assistant);
    expect(calls).toHaveLength(1);
  });

  it('offline: shows the one line, calls nothing, and keeps the text in the box', async () => {
    const { assistant, calls } = fakeAssistant();
    const { sent, added } = await run('where is the bovie', context({ offline: true }), assistant);
    expect(calls).toHaveLength(0);
    expect(sent).toBe(false);
    expect(added).toEqual([{ role: 'assistant', text: OFFLINE_LINE, tone: 'warn' }]);
    expect(OFFLINE_LINE).toBe('The AI needs internet. Your matches are still above.');
  });

  it('no connection to the assistant: shows the same line after the message', async () => {
    const { assistant } = fakeAssistant({ kind: 'offline' });
    const { added } = await run('where is the bovie', context(), assistant);
    expect(added.map((m) => m.text)).toEqual(['where is the bovie', OFFLINE_LINE]);
  });

  it('a server error shows in red', async () => {
    const { assistant } = fakeAssistant({ kind: 'error', message: 'Daily limit reached.' });
    const { added } = await run('hi', context(), assistant);
    expect(added[1]).toEqual({ role: 'assistant', text: 'Daily limit reached.', tone: 'danger' });
  });

  it('blocks patient details on the phone and calls nothing', async () => {
    const { assistant, calls } = fakeAssistant();
    const { sent, added } = await run('pt Smith needs a bovie', context(), assistant);
    expect(calls).toHaveLength(0);
    expect(sent).toBe(false);
    expect(added[0]).toMatchObject({ role: 'assistant', tone: 'danger', note: 'Nothing was sent.' });
  });

  it('drops actions with ids the phone does not know, and marks drafts ready', async () => {
    const { assistant } = fakeAssistant({
      kind: 'answer',
      reply: 'Here.',
      backup: true,
      actions: [
        { type: 'open_item', item_id: 'made-up' },
        { type: 'draft_card', kind: 'edit', card_id: 'c-lap', surgeon: null, procedure: null, specialty: null, notes: 'Warm room', summary: 'Note' },
      ],
    });
    const { added } = await run('add a note', context(), assistant);
    expect(added[1].actions).toHaveLength(1);
    expect(added[1].drafts).toEqual({ 0: { state: 'ready' } });
    expect(added[1].engine).toBe('backup');
  });

  it('sends only real turns as history, not notes or errors', async () => {
    const { assistant, calls } = fakeAssistant();
    const history = [
      { id: 1, role: 'user' as const, text: 'hi' },
      { id: 2, role: 'assistant' as const, text: OFFLINE_LINE, tone: 'warn' as const },
      { id: 3, role: 'assistant' as const, text: 'Hello.' },
    ];
    await run('bovie', context({ history }), assistant);
    expect(calls[0].history).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'Hello.' },
    ]);
  });

  it('asks to join a department first, and calls nothing', async () => {
    const { assistant, calls } = fakeAssistant();
    const { added } = await run('bovie', context({ deptId: null }), assistant);
    expect(calls).toHaveLength(0);
    expect(added[0].tone).toBe('warn');
  });

  it('ignores an empty box', async () => {
    const { assistant, calls } = fakeAssistant();
    const { sent, added } = await run('   ', context(), assistant);
    expect([sent, added.length, calls.length]).toEqual([false, 0, 0]);
  });
});
