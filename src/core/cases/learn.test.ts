// The case learns: opening a card or naming one card in a sent message sets the case; hand-set wins.
import { describe, expect, it } from '@jest/globals';

import type { Case } from '../../contracts/cases';
import type { Card } from '../../contracts/library';
import { wordSearch } from '../search/engine';
import { cardFromText, makeCaseLearning } from './learn';

function card(id: string, surgeon: string, procedure: string, specialty: string | null = null): Card {
  return { id, department_id: 'd1', surgeon, procedure, specialty, notes: null, version: 1 };
}

const CARDS: Card[] = [
  card('lee-cabg', 'Dr. Lee', 'CABG', 'Cardiac'),
  card('patel-cabg', 'Dr. Patel', 'CABG x3', 'Cardiac'),
  card('avery-chole', 'Dr. Avery', 'Laparoscopic cholecystectomy', 'General'),
  card('avery-hernia', 'Dr. Avery', 'Laparoscopic inguinal hernia repair', 'General'),
];

function aCase(patch: Partial<Case> = {}): Case {
  return {
    id: 'case-1',
    createdAt: '2026-11-11T07:42:00.000Z',
    lastUsedAt: '2026-11-11T07:42:00.000Z',
    surgeon: null,
    procedure: null,
    cardId: null,
    setByNurse: false,
    messages: [],
    ...patch,
  };
}

const learning = makeCaseLearning(wordSearch);

describe('opening a preference card', () => {
  it('sets the surgeon, procedure and card', () => {
    const next = learning.fromCard(aCase(), CARDS[2]);
    expect(next).toMatchObject({ surgeon: 'Dr. Avery', procedure: 'Laparoscopic cholecystectomy', cardId: 'avery-chole', setByNurse: false });
  });

  it('moves a learned case to the newly opened card', () => {
    const learned = learning.fromCard(aCase(), CARDS[0]);
    expect(learning.fromCard(learned, CARDS[2]).cardId).toBe('avery-chole');
  });

  it('gives back the same case when nothing changes', () => {
    const learned = learning.fromCard(aCase(), CARDS[0]);
    expect(learning.fromCard(learned, CARDS[0])).toBe(learned);
  });
});

describe('a sent message', () => {
  it.each([
    ['lee cabg', 'lee-cabg'],
    ["Avery's lap chole", 'avery-chole'],
    ['Avery’s lap chole', 'avery-chole'],
    ['where is the bovie for lee cabg?', 'lee-cabg'],
    ['dr patel cabg, does he want the 4-0?', 'patel-cabg'],
    ['cabg for lee', 'lee-cabg'],
    ['avery lap chole', 'avery-chole'],
  ])('"%s" names one card and sets it', (text, id) => {
    expect(cardFromText(text, CARDS, wordSearch)?.id).toBe(id);
    expect(learning.fromText(aCase(), text, CARDS).cardId).toBe(id);
  });

  it.each([
    ['avery lap', 'two Avery cards are laparoscopic'],
    ['cabg', 'a procedure alone, and two cards'],
    ['avery', 'a surgeon alone'],
    ['where is the bovie', 'no card'],
    ['lee cabg then avery lap chole', 'two different cards'],
  ])('"%s" sets nothing (%s)', (text) => {
    const c = aCase();
    expect(cardFromText(text, CARDS, wordSearch)).toBeNull();
    expect(learning.fromText(c, text, CARDS)).toBe(c);
  });

  it('two cards that both match set nothing', () => {
    const twins = [card('a', 'Dr. Lee', 'CABG'), card('b', 'Dr. Lee', 'CABG')];
    expect(cardFromText('lee cabg', twins, wordSearch)).toBeNull();
  });

  it('sets nothing when the department has no cards', () => {
    expect(cardFromText('lee cabg', [], wordSearch)).toBeNull();
  });
});

describe('a case the nurse set by hand', () => {
  const handSet = learning.byHand(aCase(), CARDS[0]);

  it('is marked as set by the nurse', () => {
    expect(handSet).toMatchObject({ surgeon: 'Dr. Lee', procedure: 'CABG', cardId: 'lee-cabg', setByNurse: true });
  });

  it('is never changed by opening a card', () => {
    expect(learning.fromCard(handSet, CARDS[2])).toBe(handSet);
  });

  it('is never changed by a sent message', () => {
    expect(learning.fromText(handSet, "Avery's lap chole", CARDS)).toBe(handSet);
  });

  it('Clear makes the case unknown again, and it can learn again', () => {
    const cleared = learning.byHand(handSet, null);
    expect(cleared).toMatchObject({ surgeon: null, procedure: null, cardId: null, setByNurse: false });
    expect(learning.fromText(cleared, 'avery lap chole', CARDS).cardId).toBe('avery-chole');
  });
});
