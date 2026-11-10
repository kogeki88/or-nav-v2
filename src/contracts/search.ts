// The search port: the Library box (and later voice search, Brick 7) asks it for ranked results.
import type { Card, Item } from './library';

/**
 * How well a record matched, best first. Every typed word must match a word in the record;
 * the record's level is its weakest typed word. Sound-alike comes in a later ticket.
 * With no typed words, every record comes back as 'exact'.
 */
export type MatchLevel = 'exact' | 'start' | 'sound';

export type Ranked<T> = { record: T; level: MatchLevel };

export type SearchResults = { items: Ranked<Item>[]; cards: Ranked<Card>[] };

/** One department's items and cards, ready to search. Build it once per library load. */
export interface LibrarySearch {
  /** Results in order: best level first, then name (items) or procedure then surgeon (cards). */
  search(text: string): SearchResults;
}

export interface SearchEngine {
  index(items: Item[], cards: Card[]): LibrarySearch;
}
