// Search engine behind the search port (src/contracts/search.ts). Pure TypeScript, offline.
// Items are searched by name, other names and category; cards by surgeon, procedure and specialty.
// A typed word matches a record word exactly, at its start, or by sound (Double Metaphone codes).
import { doubleMetaphone } from 'double-metaphone';

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

/**
 * Sound codes for a word; none for words under 3 letters or with digits, so they never sound-alike match.
 * A word that starts with "ch" also gets the codes of "k" + the rest: Greek medical words say "ch" as K
 * (cholecystectomy, chondroplasty), but Double Metaphone reads "chol" and "chon" as in "church".
 */
function soundCodes(word: string): string[] {
  if (word.length < 3 || /\d/.test(word)) return [];
  const codes = doubleMetaphone(word);
  if (word.startsWith('ch')) codes.push(...doubleMetaphone(`k${word.slice(2)}`));
  return codes.filter(Boolean);
}

type Entry<T> = { record: T; words: string[]; sounds: Set<string> };
type Typed = { word: string; sounds: string[] };

/** Best level for one typed word against a record, or -1 when it does not match. */
function wordLevel(typed: Typed, entry: Entry<unknown>): number {
  if (entry.words.includes(typed.word)) return 0;
  if (entry.words.some((w) => w.startsWith(typed.word))) return 1;
  if (typed.sounds.some((code) => entry.sounds.has(code))) return 2;
  return -1;
}

/** The record's level is its weakest typed word; -1 when any typed word does not match. */
function recordLevel(typed: Typed[], entry: Entry<unknown>): number {
  let worst = 0;
  for (const t of typed) {
    const level = wordLevel(t, entry);
    if (level < 0) return -1;
    worst = Math.max(worst, level);
  }
  return worst;
}

/** Entries are already in name order, so grouping by level keeps name order inside each level. */
function rank<T>(entries: Entry<T>[], typed: Typed[]): Ranked<T>[] {
  const byLevel: Ranked<T>[][] = LEVELS.map(() => []);
  for (const e of entries) {
    const level = recordLevel(typed, e);
    if (level >= 0) byLevel[level].push({ record: e.record, level: LEVELS[level] });
  }
  return byLevel.flat();
}

/** Builds the entries once per library load, sorted in name order. */
function entries<T>(records: T[], recordWords: (r: T) => string[], byName: (a: T, b: T) => number): Entry<T>[] {
  return [...records].sort(byName).map((record) => {
    const w = recordWords(record);
    return { record, words: w, sounds: new Set(w.flatMap(soundCodes)) };
  });
}

const itemOrder = (a: Item, b: Item) => a.name.localeCompare(b.name);
const cardOrder = (a: Card, b: Card) => a.procedure.localeCompare(b.procedure) || a.surgeon.localeCompare(b.surgeon);

export const wordSearch: SearchEngine = {
  index(items: Item[], cards: Card[]): LibrarySearch {
    const itemEntries = entries(items, (r) => words(r.name, r.category, ...r.synonyms), itemOrder);
    const cardEntries = entries(cards, (r) => words(r.surgeon, r.procedure, r.specialty), cardOrder);
    return {
      search(text: string) {
        const typed = words(text).map((word) => ({ word, sounds: soundCodes(word) }));
        return { items: rank(itemEntries, typed), cards: rank(cardEntries, typed) };
      },
    };
  },
};
