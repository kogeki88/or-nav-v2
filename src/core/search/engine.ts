// Search engine behind the search port (src/contracts/search.ts). Pure TypeScript, offline.
// Items are searched by name, other names and category; cards by surgeon, procedure and specialty.
import type { Card, Item } from '../../contracts/library';
import type { LibrarySearch, MatchLevel, Ranked, SearchEngine } from '../../contracts/search';

const LEVELS: MatchLevel[] = ['exact', 'start', 'sound'];

/** Lower case, accents removed, punctuation to spaces, split into words. */
function words(...texts: (string | null | undefined)[]): string[] {
  return texts.flatMap((t) =>
    (t ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean),
  );
}

/** Best level for one typed word against a record's words, or -1 when it does not match. */
function wordLevel(typed: string, recordWords: string[]): number {
  if (recordWords.includes(typed)) return 0;
  if (recordWords.some((w) => w.startsWith(typed))) return 1;
  return -1;
}

/** The record's level is its weakest typed word; -1 when any typed word does not match. */
function recordLevel(typed: string[], recordWords: string[]): number {
  let worst = 0;
  for (const t of typed) {
    const level = wordLevel(t, recordWords);
    if (level < 0) return -1;
    worst = Math.max(worst, level);
  }
  return worst;
}

function rank<T>(entries: { record: T; words: string[] }[], typed: string[], byName: (a: T, b: T) => number): Ranked<T>[] {
  const found: { record: T; level: number }[] = [];
  for (const e of entries) {
    const level = recordLevel(typed, e.words);
    if (level >= 0) found.push({ record: e.record, level });
  }
  found.sort((a, b) => a.level - b.level || byName(a.record, b.record));
  return found.map((f) => ({ record: f.record, level: LEVELS[f.level] }));
}

const itemOrder = (a: Item, b: Item) => a.name.localeCompare(b.name);
const cardOrder = (a: Card, b: Card) => a.procedure.localeCompare(b.procedure) || a.surgeon.localeCompare(b.surgeon);

export const wordSearch: SearchEngine = {
  index(items: Item[], cards: Card[]): LibrarySearch {
    const itemEntries = items.map((record) => ({ record, words: words(record.name, record.category, ...record.synonyms) }));
    const cardEntries = cards.map((record) => ({ record, words: words(record.surgeon, record.procedure, record.specialty) }));
    return {
      search(text: string) {
        const typed = words(text);
        return { items: rank(itemEntries, typed, itemOrder), cards: rank(cardEntries, typed, cardOrder) };
      },
    };
  },
};
