import { describe, expect, it } from '@jest/globals';

import { checkAnswer } from './answer';

const good = { reply: 'The Bovie pencil is at A1, Bin 1.', actions: [{ type: 'open_item', item_id: 'abc' }] };

describe('checkAnswer: a model answer that matches the answer schema', () => {
  it('accepts a clean JSON answer', () => {
    expect(checkAnswer(JSON.stringify(good))).toEqual(good);
  });

  it('accepts JSON inside a ```json fence or after a short lead-in', () => {
    expect(checkAnswer('```json\n' + JSON.stringify(good) + '\n```')).toEqual(good);
    expect(checkAnswer('Here is the answer:\n' + JSON.stringify(good))).toEqual(good);
  });

  it('accepts a full draft_card_line with nulls', () => {
    const a = {
      reply: 'Ready to send.',
      actions: [
        {
          type: 'draft_card_line', kind: 'add', card_id: 'c1', card_item_id: null, item_id: 'i1',
          phase: 'Closure', quantity: 2, open_or_hold: 'open', note: null, summary: 'Add 2 x 0 Vicryl to Closure (open)',
        },
      ],
    };
    expect(checkAnswer(JSON.stringify(a))).toEqual(a);
  });
});

describe('checkAnswer: ids copied with their library label', () => {
  it('drops the item:, card:, line: and dept: label the prompt shows in front of each id', () => {
    const a = {
      reply: 'x',
      actions: [
        { type: 'open_item', item_id: 'item:i1' },
        { type: 'show_results', item_ids: ['item:i2', 'i3'], card_ids: ['card:c1'] },
        { type: 'switch_department', department_id: 'dept:d1' },
        {
          type: 'draft_card_line', kind: 'remove', card_id: 'card:c2', card_item_id: 'line:l1', item_id: null,
          phase: null, quantity: null, open_or_hold: null, note: null, summary: 'Remove the tacker',
        },
      ],
    };
    expect(checkAnswer(JSON.stringify(a))?.actions).toEqual([
      { type: 'open_item', item_id: 'i1' },
      { type: 'show_results', item_ids: ['i2', 'i3'], card_ids: ['c1'] },
      { type: 'switch_department', department_id: 'd1' },
      {
        type: 'draft_card_line', kind: 'remove', card_id: 'c2', card_item_id: 'l1', item_id: null,
        phase: null, quantity: null, open_or_hold: null, note: null, summary: 'Remove the tacker',
      },
    ]);
  });
});

describe('checkAnswer: broken answers give null', () => {
  it.each([
    ['empty text', ''],
    ['not JSON', 'The bovie is on shelf A1.'],
    ['cut-off JSON', '{"reply": "The bovie is'],
    ['no reply', JSON.stringify({ actions: [] })],
    ['an unknown action type', JSON.stringify({ reply: 'x', actions: [{ type: 'delete_all' }] })],
    ['a missing required field', JSON.stringify({ reply: 'x', actions: [{ type: 'open_item' }] })],
    ['an extra field', JSON.stringify({ reply: 'x', actions: [{ type: 'open_item', item_id: 'a', why: 'b' }] })],
    ['a phase that does not exist', JSON.stringify({
      reply: 'x',
      actions: [{ type: 'draft_card_line', kind: 'add', card_id: 'c', card_item_id: null, item_id: 'i', phase: 'Prep', quantity: 1, open_or_hold: 'open', note: null, summary: 's' }],
    })],
    ['a quantity that is not a whole number', JSON.stringify({
      reply: 'x',
      actions: [{ type: 'draft_card_line', kind: 'add', card_id: 'c', card_item_id: null, item_id: 'i', phase: 'Setup', quantity: 1.5, open_or_hold: 'open', note: null, summary: 's' }],
    })],
  ])('%s', (_name, text) => {
    expect(checkAnswer(text)).toBeNull();
  });
});
