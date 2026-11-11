// How a case learns its surgeon, procedure and card (the CaseLearning port). Pure TypeScript.
// Opening a card sets it. A sent message sets it when its words name exactly one card by surgeon
// AND procedure, matched through the search port (sound-alike spelling works too). A case the
// nurse set by hand is never changed by learning. Nothing here asks the nurse anything.
import type { Case, CaseLearning } from '../../contracts/cases';
import type { Card } from '../../contracts/library';
import type { LibrarySearch, SearchEngine } from '../../contracts/search';

/** Longest run of words looked at as one "surgeon + procedure" phrase. */
const MAX_PHRASE = 6;
/** Only the start of a long message is looked at. */
const MAX_WORDS = 60;
/** Small talk around a case name: dropped before matching, so "cabg for lee" reads as "cabg lee". */
const FILLER = new Set(
  'a an and are at be by can did do does doctor dr for from has have he her his how in is it me my need needs of on or our please pt she that the their then there they this to today wants want was we what when where which who why will with you your'.split(' '),
);

function messageWords(text: string): string[] {
  return text
    .replace(/['’]s\b/gi, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .slice(0, MAX_WORDS);
}

/** Card ids that match a phrase in one index, remembered per phrase. */
function matcher(index: LibrarySearch) {
  const seen = new Map<string, Set<string>>();
  return (phrase: string[]): Set<string> => {
    const key = phrase.join(' ');
    let ids = seen.get(key);
    if (!ids) {
      ids = new Set(index.search(key).cards.map((r) => r.record.id));
      seen.set(key, ids);
    }
    return ids;
  };
}

function both(a: Set<string>, b: Set<string>, into: Set<string>) {
  for (const id of a) if (b.has(id)) into.add(id);
}

/**
 * The one card these words name, or null. A phrase (a run of 2 to 6 words) names a card when one
 * part of it matches the card's surgeon and the rest matches its procedure, in either order.
 * Only the longest matching phrases count, so "avery lap chole" is not also read as "avery lap".
 * Two or more different cards named: null.
 */
export function cardFromText(text: string, cards: Card[], engine: SearchEngine): Card | null {
  if (cards.length === 0) return null;
  const words = messageWords(text);
  if (words.length < 2) return null;
  const surgeon = matcher(engine.index([], cards.map((c) => ({ ...c, procedure: '', specialty: null }))));
  const procedure = matcher(engine.index([], cards.map((c) => ({ ...c, surgeon: '', specialty: null }))));

  type Hit = { start: number; end: number; ids: Set<string> };
  const hits: Hit[] = [];
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 2; end <= Math.min(words.length, start + MAX_PHRASE); end++) {
      const ids = new Set<string>();
      for (let cut = start + 1; cut < end; cut++) {
        const first = words.slice(start, cut);
        const rest = words.slice(cut, end);
        both(surgeon(first), procedure(rest), ids);
        both(procedure(first), surgeon(rest), ids);
      }
      if (ids.size > 0) hits.push({ start, end, ids });
    }
  }

  const longest = hits.filter((h) => !hits.some((o) => o !== h && o.start <= h.start && o.end >= h.end));
  const named = new Set<string>();
  for (const h of longest) for (const id of h.ids) named.add(id);
  if (named.size !== 1) return null;
  const [id] = named;
  return cards.find((c) => c.id === id) ?? null;
}

function withCard(c: Case, card: Card, setByNurse: boolean): Case {
  if (c.cardId === card.id && c.surgeon === card.surgeon && c.procedure === card.procedure && c.setByNurse === setByNurse) return c;
  return { ...c, surgeon: card.surgeon, procedure: card.procedure, cardId: card.id, setByNurse };
}

export function makeCaseLearning(engine: SearchEngine): CaseLearning {
  return {
    fromCard: (c, card) => (c.setByNurse ? c : withCard(c, card, false)),
    fromText(c, text, cards) {
      if (c.setByNurse) return c;
      const card = cardFromText(text, cards, engine);
      return card ? withCard(c, card, false) : c;
    },
    byHand(c, card) {
      if (card) return withCard(c, card, true);
      if (!c.surgeon && !c.procedure && !c.cardId && !c.setByNurse) return c;
      return { ...c, surgeon: null, procedure: null, cardId: null, setByNurse: false };
    },
  };
}
