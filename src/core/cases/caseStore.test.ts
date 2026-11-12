// The case store through its port, on an in-memory table (the SQLite adapter uses the same rows).
import { describe, expect, it } from '@jest/globals';

import type { Assistant } from '../../contracts/assistant';
import type { Case, CaseMessage } from '../../contracts/cases';
import type { LibraryData } from '../../contracts/library';
import { NewMessage, sendTurn } from '../../omnibar/conversation';
import { makeCaseStore, memoryCaseRows } from './caseStore';
import { fromCaseRow, toCaseRow } from './rows';

const t0 = new Date(2026, 10, 11, 7, 42);
const later = (min: number) => new Date(t0.getTime() + min * 60_000);

function withMessage(c: Case, text: string, at: Date): Case {
  return { ...c, lastUsedAt: at.toISOString(), messages: [...c.messages, { id: c.messages.length + 1, role: 'user', text }] };
}

describe('case store', () => {
  it('saves and reads back the messages and the label', async () => {
    const store = makeCaseStore(memoryCaseRows());
    const c = { ...withMessage(store.startNew(t0), 'where is the bovie', t0), surgeon: 'Dr. Avery', procedure: 'Lap chole', cardId: 'c-lap' };
    await store.save(c);
    const back = await store.get(c.id);
    expect(back).toEqual(c);
    expect(store.label(back!)).toBe('Dr. Avery, lap chole');
  });

  it('does not save an empty case', async () => {
    const store = makeCaseStore(memoryCaseRows());
    await store.save(store.startNew(t0));
    expect(await store.listRecent()).toEqual([]);
  });

  it('keeps only the last 20 cases', async () => {
    const store = makeCaseStore(memoryCaseRows());
    let recent: Case[] = [];
    for (let i = 0; i < 21; i++) recent = await store.save(withMessage(store.startNew(later(i)), `q${i}`, later(i)));
    expect(recent).toHaveLength(20);
    expect(recent[0].messages[0].text).toBe('q20');
    expect(recent.map((c) => c.messages[0].text)).not.toContain('q0');
    expect(await store.listRecent()).toEqual(recent);
  });

  it('on open: reopens the last case within 4 hours, else starts a new one', async () => {
    const store = makeCaseStore(memoryCaseRows());
    const c = withMessage(store.startNew(t0), 'hello', t0);
    await store.save(c);
    expect((await store.openOnStart(later(200))).current.id).toBe(c.id);
    const fresh = await store.openOnStart(later(241));
    expect(fresh.current.id).not.toBe(c.id);
    expect(fresh.current.messages).toEqual([]);
    expect(fresh.recent.map((r) => r.id)).toEqual([c.id]);
  });

  it('a row survives the trip to the database and back', () => {
    const c = withMessage({ id: 'x', createdAt: t0.toISOString(), lastUsedAt: t0.toISOString(), surgeon: null, procedure: null, cardId: null, setByNurse: true, messages: [] }, 'hi', t0);
    expect(fromCaseRow(toCaseRow(c))).toEqual(c);
    expect(fromCaseRow({ ...toCaseRow(c), messages: 'not json' }).messages).toEqual([]);
  });
});

describe('what a case stores', () => {
  const data: LibraryData = { hospitals: [], departments: [], memberships: [], items: [], cards: [], cardItems: [], requests: [], loadedAt: '' };
  const assistant: Assistant = { ask: async () => ({ kind: 'answer', reply: 'Ask the charge nurse.', actions: [], model: 'Nemotron Ultra' }) };

  async function sendInto(store: ReturnType<typeof makeCaseStore>, c: Case, raw: string): Promise<Case> {
    let cur = c;
    const add = (m: NewMessage) => {
      const msg: CaseMessage = { ...m, id: cur.messages.length + 1 };
      cur = { ...cur, messages: [...cur.messages, msg] };
    };
    await sendTurn(raw, { deptId: 'd1', offline: false, staff: [], history: [], data, myDeptIds: ['d1'] }, assistant, add);
    await store.save(cur);
    return (await store.get(cur.id)) ?? store.startNew(t0);
  }

  it('stores the scrubbed text that was sent, never the raw text', async () => {
    const store = makeCaseStore(memoryCaseRows());
    const saved = await sendInto(store, store.startNew(t0), 'call me at 555-123-4567 about the bovie');
    const all = JSON.stringify(saved.messages);
    expect(all).not.toContain('555-123-4567');
    expect(saved.messages[0].role).toBe('user');
    expect(saved.messages[0].text).toContain('bovie');
    expect(saved.messages[1].text).toBe('Ask the charge nurse.');
  });

  it('stores nothing from a message the scrubber blocked', async () => {
    const store = makeCaseStore(memoryCaseRows());
    const c = store.startNew(t0);
    await sendInto(store, c, 'pt John Smith DOB 01/02/1960 needs a bovie');
    expect(await store.listRecent()).toEqual([]);
  });
});
