// Case rules: reopen within 4 hours, keep the last 20, the time name, what may be saved.
import { describe, expect, it } from '@jest/globals';

import type { Case } from '../../contracts/cases';
import { MAX_CASES, caseLabel, caseTimeName, caseWhen, keepLast, pickOnOpen, toSave } from './rules';

function aCase(id: string, lastUsed: Date, patch: Partial<Case> = {}): Case {
  return {
    id,
    createdAt: lastUsed.toISOString(),
    lastUsedAt: lastUsed.toISOString(),
    surgeon: null,
    procedure: null,
    cardId: null,
    setByNurse: false,
    messages: [{ id: 1, role: 'user', text: 'where is the bovie' }],
    ...patch,
  };
}

const now = new Date(2026, 10, 11, 9, 0);
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe('pickOnOpen', () => {
  it('reopens the last case when it was used in the last 4 hours', () => {
    const recent = [aCase('old', minutesAgo(300)), aCase('last', minutesAgo(239))];
    expect(pickOnOpen(recent, now)?.id).toBe('last');
  });

  it('starts a new case when the last one was used more than 4 hours ago', () => {
    expect(pickOnOpen([aCase('last', minutesAgo(241))], now)).toBeNull();
  });

  it('starts a new case when there are no cases', () => {
    expect(pickOnOpen([], now)).toBeNull();
  });
});

describe('keepLast', () => {
  it('keeps the 20 last used and lets the oldest go first', () => {
    const cases = Array.from({ length: 22 }, (_, i) => aCase(`c${i}`, minutesAgo(1000 - i)));
    const { keep, drop } = keepLast(cases);
    expect(MAX_CASES).toBe(20);
    expect(keep).toHaveLength(20);
    expect(keep[0].id).toBe('c21');
    expect(drop.sort()).toEqual(['c0', 'c1']);
  });
});

describe('names', () => {
  it('names a case by its start time while the surgeon is unknown', () => {
    expect(caseTimeName(new Date(2026, 10, 11, 7, 42))).toBe('Case 7:42');
    expect(caseTimeName(new Date(2026, 10, 11, 7, 5))).toBe('Case 7:05');
    expect(caseTimeName(new Date(2026, 10, 11, 14, 30))).toBe('Case 2:30');
    expect(caseTimeName(new Date(2026, 10, 11, 0, 15))).toBe('Case 12:15');
    expect(caseLabel(aCase('a', new Date(2026, 10, 11, 7, 42)))).toBe('Case 7:42');
  });

  it('names a known case by surgeon and procedure', () => {
    expect(caseLabel(aCase('a', now, { surgeon: 'Dr. Avery', procedure: 'Lap chole' }))).toBe('Dr. Avery, lap chole');
    expect(caseLabel(aCase('a', now, { surgeon: 'Dr. Lee', procedure: 'CABG' }))).toBe('Dr. Lee, CABG');
  });

  it('says when a case was used the short way', () => {
    expect(caseWhen(aCase('a', new Date(2026, 10, 11, 7, 10)), now)).toBe('7:10');
    expect(caseWhen(aCase('a', new Date(2026, 10, 10, 18, 0)), now)).toBe('Yesterday');
    expect(caseWhen(aCase('a', new Date(2026, 10, 9, 18, 0)), now)).toBe('Mon');
    expect(caseWhen(aCase('a', new Date(2026, 10, 3, 18, 0)), now)).toBe('Nov 3');
  });
});

describe('toSave', () => {
  it('keeps only what went to the AI and came back: lines made on the phone are not saved', () => {
    const c = aCase('a', now, {
      messages: [
        { id: 1, role: 'user', text: 'call [phone]', note: 'Removed for privacy: a phone number.' },
        { id: 2, role: 'assistant', text: 'The AI needs internet. Your matches are still above.', tone: 'warn', local: true },
        { id: 3, role: 'assistant', text: 'Done.', drafts: { 0: { state: 'sending' } } },
      ],
    });
    const saved = toSave(c);
    expect(saved.messages.map((m) => m.id)).toEqual([1, 3]);
    // A draft half-sent when the app closed can be sent again.
    expect(saved.messages[1].drafts).toEqual({ 0: { state: 'ready' } });
  });
});
