// The view logic, fed with the demo library from a fresh demo adapter in each test.
import { describe, expect, it } from '@jest/globals';

import { DEMO_USER_ID, demoSource } from './demoSource';
import { myDepartments, myPending, searchCards, searchItems, toReview } from './logic';

describe('view logic on the demo library', () => {
  it('searches items by name, synonym and location, in name order', async () => {
    const data = await demoSource().load();
    expect(searchItems(data.items, 'debakeys').map((i) => i.name)).toEqual(['DeBakey forceps']);
    expect(searchItems(data.items, 'prolene').map((i) => i.name)).toEqual(['4-0 Prolene']);
    expect(searchItems(data.items, 'suture cart').map((i) => i.name)).toEqual(['0 Vicryl CT-1', '4-0 Prolene']);
    expect(searchItems(data.items, 'nothing like this')).toEqual([]);
  });

  it('searches preference cards by surgeon, procedure and specialty', async () => {
    const data = await demoSource().load();
    expect(searchCards(data.cards, 'cabg').map((c) => c.id)).toEqual(['c-cabg']);
    expect(searchCards(data.cards, 'kim').map((c) => c.id)).toEqual(['c-chole']);
    expect(searchCards(data.cards, 'cardiac').map((c) => c.procedure)).toEqual(['AVR', 'CABG x3']);
  });

  it('lists my departments with their hospital, sorted', async () => {
    const data = await demoSource().load();
    expect(myDepartments(data, DEMO_USER_ID).map((m) => `${m.hospital?.name} · ${m.department.name}`)).toEqual([
      'Sample General Hospital · CVOR / Cardiac OR',
      'Sample General Hospital · Main OR',
    ]);
  });

  it("lists a colleague's pending changes to review, oldest first", async () => {
    const data = await demoSource().load();
    expect(toReview(data, DEMO_USER_ID).map((r) => r.id)).toEqual(['r-2', 'r-1']);
  });

  it('drops a reviewed change from the review list', async () => {
    const source = demoSource();
    await source.review('r-2', 'reject');
    expect(toReview(await source.load(), DEMO_USER_ID).map((r) => r.id)).toEqual(['r-1']);
  });

  it('lists my own pending changes, and not in my review list', async () => {
    const source = demoSource();
    expect(myPending(await source.load(), DEMO_USER_ID)).toEqual([]);
    await source.propose({ department_id: 'd-main', kind: 'edit', target: 'card', target_id: 'c-chole', data: { notes: 'x' }, base_version: 1 });
    const data = await source.load();
    expect(myPending(data, DEMO_USER_ID).map((r) => r.target_id)).toEqual(['c-chole']);
    expect(toReview(data, DEMO_USER_ID).map((r) => r.id)).toEqual(['r-2', 'r-1']);
  });
});
