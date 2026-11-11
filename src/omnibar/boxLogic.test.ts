// The one box's plain rules: matches while typing, and the rows under an AI answer.
import { describe, expect, it } from '@jest/globals';

import type { Card, CardItem, Item, LibraryData } from '../contracts/library';
import { wordSearch } from '../core/search/engine';
import { answerRows, boxMatches, freshBase, shelfBin } from './boxLogic';

const item = (id: string, name: string, shelf: string | null, sub: string | null, dept = 'd1'): Item => ({
  id,
  department_id: dept,
  name,
  category: null,
  shelf,
  sub_location: sub,
  synonyms: [],
  notes: null,
  photo_path: null,
  version: 1,
});
const card = (id: string, surgeon: string, procedure: string, dept = 'd1'): Card => ({ id, department_id: dept, surgeon, procedure, specialty: null, notes: null, version: 1 });
const line = (id: string, card_id: string, item_id: string, open_or_hold: 'open' | 'hold' = 'open', dept = 'd1'): CardItem => ({
  id,
  department_id: dept,
  card_id,
  item_id,
  phase: 'Setup',
  quantity: 1,
  open_or_hold,
  note: null,
  sort_order: 1,
});

const data: LibraryData = {
  hospitals: [],
  departments: [],
  memberships: [],
  items: [item('i-bovie', 'Bovie pencil', 'A1', 'Bin 1'), item('i-bag', 'Specimen retrieval bag', 'A4', 'Bin 1'), item('i-other', 'Bovie pencil', 'Z9', 'Bin 9', 'd2')],
  cards: [card('c-lap', 'Dr. Avery', 'Lap chole'), card('c-tka', 'Dr. Patel', 'Total knee'), card('c-cabg', 'Dr. Lee', 'CABG', 'd2')],
  cardItems: [line('l1', 'c-lap', 'i-bovie'), line('l2', 'c-tka', 'i-bovie'), line('l3', 'c-lap', 'i-bag', 'hold'), line('l4', 'c-cabg', 'i-bovie', 'open', 'd2')],
  requests: [],
  loadedAt: '',
};

const index = wordSearch.index(
  data.items.filter((i) => i.department_id === 'd1'),
  data.cards.filter((c) => c.department_id === 'd1'),
);

describe('shelfBin', () => {
  it('writes shelf and bin the way a nurse says it', () => {
    expect(shelfBin(item('x', 'X', 'A1', 'Bin 1'))).toBe('A1, bin 1');
    expect(shelfBin(item('x', 'X', 'A1', null))).toBe('A1');
    expect(shelfBin(item('x', 'X', null, 'Drawer 2'))).toBe('drawer 2');
    expect(shelfBin(item('x', 'X', null, null))).toBe('');
  });
});

describe('boxMatches', () => {
  it('finds the Bovie pencil by sound, with the cards that use it in this department', () => {
    const m = boxMatches('bovee', index, data, 'd1');
    expect(m.items.map((i) => i.id)).toEqual(['i-bovie']);
    expect(m.cards.map((c) => c.id)).toEqual(['c-lap', 'c-tka']);
  });

  it('shows nothing for an empty box', () => {
    expect(boxMatches('   ', index, data, 'd1')).toEqual({ items: [], cards: [] });
  });

  it('lists a card matched by name once, before cards that only hold a matched item', () => {
    const m = boxMatches('lap', index, data, 'd1');
    expect(m.cards.map((c) => c.id)).toEqual(['c-lap']);
  });

  it('keeps at most 5 items and 5 cards', () => {
    const many: LibraryData = { ...data, items: Array.from({ length: 8 }, (_, n) => item(`i${n}`, `Sponge ${n}`, 'A', null)) };
    const m = boxMatches('sponge', wordSearch.index(many.items, []), many, 'd1');
    expect(m.items).toHaveLength(5);
  });
});

describe('answerRows', () => {
  it('turns the AI actions into card rows, then item rows, with Hold or Open from the cards in the answer', () => {
    const rows = answerRows([{ type: 'show_results', item_ids: ['i-bag', 'i-bovie'], card_ids: ['c-lap'] }], data);
    expect(rows).toEqual([
      { kind: 'card', card: data.cards[0] },
      { kind: 'item', item: data.items[1], tag: 'hold' },
      { kind: 'item', item: data.items[0], tag: 'open' },
    ]);
  });

  it('gives an item no tag when no card in the answer holds it', () => {
    expect(answerRows([{ type: 'open_item', item_id: 'i-bag' }], data)).toEqual([{ kind: 'item', item: data.items[1], tag: null }]);
  });

  it('shows each item and card once, and drops ids it cannot find', () => {
    const rows = answerRows(
      [
        { type: 'open_card', card_id: 'c-lap' },
        { type: 'show_results', item_ids: ['i-bovie', 'nope'], card_ids: ['c-lap'] },
        { type: 'open_item', item_id: 'i-bovie' },
      ],
      data,
    );
    expect(rows.map((r) => (r.kind === 'card' ? r.card.id : r.item.id))).toEqual(['c-lap', 'i-bovie']);
  });
});

describe('freshBase (which messages animate)', () => {
  const msgs = (...ids: number[]) => ids.map((id) => ({ id }));

  it('does not animate the old messages of a case that just opened', () => {
    const base = freshBase(null, 'case-a', msgs(1, 2, 3));
    expect(base).toEqual({ caseId: 'case-a', maxId: 3 });
  });

  it('animates every message of a new, empty case', () => {
    expect(freshBase(null, 'case-new', msgs()).maxId).toBe(0);
  });

  it('keeps the same line while the case stays open, so new messages animate', () => {
    const base = freshBase(null, 'case-a', msgs(1));
    expect(freshBase(base, 'case-a', msgs(1, 2, 3))).toBe(base);
  });

  it('starts again when another case opens, so going back does not replay', () => {
    const base = freshBase(null, 'case-a', msgs(1));
    expect(freshBase(base, 'case-b', msgs(1, 2))).toEqual({ caseId: 'case-b', maxId: 2 });
  });
});
