// The one box's plain rules (no React): matches while typing, and the rows under an AI answer.
import type { Card, Item, LibraryData } from '../contracts/library';
import type { LibrarySearch } from '../contracts/search';
import type { OmniAction } from '../../supabase/functions/omnibar/schema';

const MAX_ROWS = 5;

/** Shelf and bin the way a nurse says it: "A1, bin 1". */
export function shelfBin(i: Pick<Item, 'shelf' | 'sub_location'>): string {
  const bin = i.sub_location ? i.sub_location.charAt(0).toLowerCase() + i.sub_location.slice(1) : null;
  return [i.shelf, bin].filter(Boolean).join(', ');
}

/**
 * What shows above the box while typing: the best items, then cards. Cards matched by name come
 * first, then this department's cards that hold a matched item ("On these cards").
 */
export function boxMatches(text: string, index: LibrarySearch, data: LibraryData, deptId: string | null): { items: Item[]; cards: Card[] } {
  if (text.trim() === '') return { items: [], cards: [] };
  const results = index.search(text);
  const items = results.items.slice(0, MAX_ROWS).map((r) => r.record);
  const cards: Card[] = results.cards.map((r) => r.record);
  const seen = new Set(cards.map((c) => c.id));
  for (const it of items) {
    const usedOn = new Set(data.cardItems.filter((ci) => ci.item_id === it.id).map((ci) => ci.card_id));
    for (const c of data.cards) {
      if (usedOn.has(c.id) && c.department_id === deptId && !seen.has(c.id)) {
        seen.add(c.id);
        cards.push(c);
      }
    }
  }
  return { items, cards: cards.slice(0, MAX_ROWS) };
}

export type AnswerRow = { kind: 'card'; card: Card } | { kind: 'item'; item: Item; tag: 'open' | 'hold' | null };

/**
 * Tappable rows under an AI answer: its cards, then its items. An item gets Open or Hold when a
 * card in the same answer holds it. Ids the phone does not know are left out; each row shows once.
 */
export function answerRows(actions: OmniAction[], data: LibraryData): AnswerRow[] {
  const cardIds: string[] = [];
  const itemIds: string[] = [];
  const addId = (list: string[], id: string) => {
    if (!list.includes(id)) list.push(id);
  };
  for (const a of actions) {
    if (a.type === 'open_card') addId(cardIds, a.card_id);
    if (a.type === 'open_item') addId(itemIds, a.item_id);
    if (a.type === 'show_results') {
      a.card_ids.forEach((id) => addId(cardIds, id));
      a.item_ids.forEach((id) => addId(itemIds, id));
    }
  }
  const rows: AnswerRow[] = [];
  for (const id of cardIds) {
    const card = data.cards.find((c) => c.id === id);
    if (card) rows.push({ kind: 'card', card });
  }
  for (const id of itemIds) {
    const item = data.items.find((i) => i.id === id);
    if (!item) continue;
    const line = data.cardItems.find((ci) => ci.item_id === id && cardIds.includes(ci.card_id));
    rows.push({ kind: 'item', item, tag: line ? line.open_or_hold : null });
  }
  return rows;
}
