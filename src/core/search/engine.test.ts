// The search engine, tested only through the search port with plain data.
import { describe, expect, it } from '@jest/globals';

import type { Card, Item } from '../../contracts/library';
import type { SearchEngine } from '../../contracts/search';
import { wordSearch } from './engine';
import { TEST_CARDS, TEST_ITEMS, WORD_LIST } from './testWordList';

const engine: SearchEngine = wordSearch;

function item(name: string, extra: Partial<Item> = {}): Item {
  return {
    id: name, department_id: 'd-main', name, category: 'Supply', shelf: 'A1', sub_location: 'Bin 1',
    synonyms: [], notes: null, photo_path: null, version: 1, ...extra,
  };
}

function card(surgeon: string, procedure: string, specialty: string): Card {
  return { id: `${surgeon}/${procedure}`, department_id: 'd-main', surgeon, procedure, specialty, notes: null, version: 1 };
}

const itemNames = (items: Item[], text: string) => engine.index(items, []).search(text).items.map((r) => r.record.name);

describe('search engine through the port', () => {
  it('finds an item by the second word of its name', () => {
    expect(itemNames([item('Bovie pencil'), item('Kocher clamp')], 'pencil')).toEqual(['Bovie pencil']);
  });

  it('lists exact whole-word matches before start-of-word matches', () => {
    const items = [item('Aortic cross-clamps'), item('Kocher clamp')];
    const results = engine.index(items, []).search('clamp').items;
    expect(results.map((r) => [r.record.name, r.level])).toEqual([
      ['Kocher clamp', 'exact'],
      ['Aortic cross-clamps', 'start'],
    ]);
  });

  it("ranks a record by its weakest typed word, then by name", () => {
    const items = [item('Kocher clamp'), item('Kelly clamp'), item('Allis clamp')];
    const results = engine.index(items, []).search('clamp k').items;
    expect(results.map((r) => [r.record.name, r.level])).toEqual([
      ['Kelly clamp', 'start'],
      ['Kocher clamp', 'start'],
    ]);
  });

  it('needs every typed word to match', () => {
    expect(itemNames([item('Bovie pencil')], 'bovie scissors')).toEqual([]);
  });

  it('searches other names and category', () => {
    const items = [item('Bovie pencil', { synonyms: ['ESU pencil', 'Cautery'] }), item('0 Vicryl CT-1', { category: 'Suture' })];
    expect(itemNames(items, 'cautery')).toEqual(['Bovie pencil']);
    expect(itemNames(items, 'suture')).toEqual(['0 Vicryl CT-1']);
  });

  it('no longer searches shelf, bin or notes', () => {
    const items = [item('Bovie pencil', { shelf: 'A3', sub_location: 'Drawer 2', notes: 'Keep the holster nearby.' })];
    expect(itemNames(items, 'a3')).toEqual([]);
    expect(itemNames(items, 'drawer')).toEqual([]);
    expect(itemNames(items, 'holster')).toEqual([]);
  });

  it('ignores case, accents and punctuation', () => {
    const items = [item('Hem-o-lok clips, large'), item('Bovie pencil')];
    expect(itemNames(items, 'BOVIE')).toEqual(['Bovie pencil']);
    expect(itemNames(items, 'bóvie')).toEqual(['Bovie pencil']);
    expect(itemNames(items, 'hem o lok')).toEqual(['Hem-o-lok clips, large']);
  });

  it('finds the one card for surgeon and procedure typed together', () => {
    const cards = [
      card('Dr. Avery', 'Laparoscopic cholecystectomy', 'General'),
      card('Dr. Avery', 'Appendectomy', 'General'),
      card('Dr. Patel', 'Laparoscopic cholecystectomy', 'General'),
    ];
    const results = engine.index([], cards).search('avery chole').cards;
    expect(results.map((r) => r.record.id)).toEqual(['Dr. Avery/Laparoscopic cholecystectomy']);
  });

  it('sorts cards at the same level by procedure, then surgeon', () => {
    const cards = [card('Dr. Patel', 'CABG x3', 'Cardiac'), card('Dr. Okafor', 'AVR', 'Cardiac'), card('Dr. Avery', 'AVR', 'Cardiac')];
    const results = engine.index([], cards).search('cardiac').cards;
    expect(results.map((r) => r.record.id)).toEqual(['Dr. Avery/AVR', 'Dr. Okafor/AVR', 'Dr. Patel/CABG x3']);
  });

  it('lists exact, then start of word, then sound-alike', () => {
    const items = [item('Bovie pencil'), item('Bovee drape'), item('Boveex tray')];
    const results = engine.index(items, []).search('bovee').items;
    expect(results.map((r) => [r.record.name, r.level])).toEqual([
      ['Bovee drape', 'exact'],
      ['Boveex tray', 'start'],
      ['Bovie pencil', 'sound'],
    ]);
  });

  it('never sound-alike matches a size with digits', () => {
    const items = [item('5 mm trocar'), item('12 mm trocar')];
    expect(itemNames(items, '12 mm')).toEqual(['12 mm trocar']);
    expect(itemNames(items, '15')).toEqual([]);
  });

  it('uses start of word only for 1 and 2 letter words', () => {
    // "bf" and "bv" sound like "Bovie" (both code to PF), but they are too short for sound-alike.
    expect(itemNames([item('Bovie pencil')], 'bf')).toEqual([]);
    expect(itemNames([item('Bovie pencil')], 'bo')).toEqual(['Bovie pencil']);
  });

  it('never sound-alike matches notes or shelf text', () => {
    const items = [item('Bovie pencil', { shelf: 'Kocher', sub_location: 'Bin 1', notes: 'Kocher nearby' })];
    expect(itemNames(items, 'kocker')).toEqual([]);
  });

  it('returns everything in the usual order when nothing is typed', () => {
    const items = [item('Kocher clamp'), item('Bovie pencil')];
    const cards = [card('Dr. Patel', 'CABG x3', 'Cardiac'), card('Dr. Okafor', 'AVR', 'Cardiac'), card('Dr. Avery', 'AVR', 'Cardiac')];
    const results = engine.index(items, cards).search('  ');
    expect(results.items.map((r) => r.record.name)).toEqual(['Bovie pencil', 'Kocher clamp']);
    expect(results.cards.map((r) => r.record.id)).toEqual(['Dr. Avery/AVR', 'Dr. Okafor/AVR', 'Dr. Patel/CABG x3']);
  });
});

describe('the test word list (testWordList.ts)', () => {
  const library = engine.index(TEST_ITEMS, TEST_CARDS);

  it.each(WORD_LIST)('"$typed" finds $finds', ({ typed, finds, first }) => {
    const results = library.search(typed);
    const found = [...results.items.map((r) => r.record.name), ...results.cards.map((r) => r.record.id)];
    expect(found).toContain(finds);
    if (first) expect(found[0]).toBe(finds);
  });

  it('"avery chole" finds only Dr. Avery\'s cholecystectomy card', () => {
    expect(library.search('avery chole').cards.map((r) => r.record.id)).toEqual(['Dr. Avery / Laparoscopic cholecystectomy']);
  });
});

describe('search speed', () => {
  it('takes under 10 ms on average for 5,000 items and 500 cards', () => {
    const parts = ['Bovie', 'Kocher', 'Metzenbaum', 'Yankauer', 'Vicryl', 'Maryland', 'trocar', 'clamp', 'pencil', 'scissors'];
    const items = Array.from({ length: 5000 }, (_, i) =>
      item(`${parts[i % 10]} ${parts[(i * 7) % 10]} ${i} mm`, { id: `i${i}`, synonyms: [`${parts[(i * 3) % 10]}x${i}`] }),
    );
    const cards = Array.from({ length: 500 }, (_, i) => ({ ...card(`Dr. ${parts[i % 10]}${i}`, `${parts[(i * 3) % 10]} repair ${i}`, 'General'), id: `c${i}` }));
    const library = engine.index(items, cards);
    const queries = ['bovee', 'kocker clamp', 'metz', 'yankower', 'vikril 12', 'pensil', 'trokar', 'b', 'mary', 'colecystectomy'];
    library.search('warm up');
    const rounds = 5;
    const start = performance.now();
    for (let r = 0; r < rounds; r++) for (const q of queries) library.search(q);
    const average = (performance.now() - start) / (rounds * queries.length);
    expect(average).toBeLessThan(10);
  });
});
