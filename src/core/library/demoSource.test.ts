// The library port, driven through the demo adapter (sample data in memory). No phone, no internet.
// Each test makes its own demoSource(), so no test depends on changes made by another.
import { describe, expect, it } from '@jest/globals';

import { DEMO_USER_ID, demoSource } from './demoSource';

const names = (rows: { name: string }[]) => rows.map((r) => r.name).sort();

describe('demo library source', () => {
  it('loads the sample hospitals, departments, items and preference cards', async () => {
    const data = await demoSource().load();
    expect(names(data.hospitals)).toEqual(['Demo Heart Center', 'Sample General Hospital']);
    expect(data.departments).toHaveLength(4);
    // Only the two departments the demo user belongs to: CVOR (6 items, 2 cards) and Main OR (4 items, 1 card).
    expect(data.items).toHaveLength(10);
    expect(names(data.items)).toContain('DeBakey forceps');
    expect(names(data.items)).not.toContain('Sternal retractor');
    expect(data.cards.map((c) => c.procedure).sort()).toEqual(['AVR', 'CABG x3', 'Lap chole']);
    expect(data.cardItems).toHaveLength(11);
    expect(data.requests.map((r) => r.id).sort()).toEqual(['r-1', 'r-2']);
  });

  it('shows a joined department on the next load', async () => {
    const source = demoSource();
    await source.join('d-heart-cvor', 'Circulating nurse');
    const data = await source.load();
    expect(data.memberships).toContainEqual({ user_id: DEMO_USER_ID, department_id: 'd-heart-cvor', job_role: 'Circulating nurse' });
    expect(names(data.items)).toContain('Sternal retractor');
  });

  it('hides a left department on the next load', async () => {
    const source = demoSource();
    await source.leave('d-main');
    const data = await source.load();
    expect(data.memberships.some((m) => m.user_id === DEMO_USER_ID && m.department_id === 'd-main')).toBe(false);
    expect(names(data.items)).not.toContain('Maryland dissector');
    expect(data.cards.map((c) => c.procedure)).not.toContain('Lap chole');
  });

  it('makes a pending change request for the proposed item', async () => {
    const source = demoSource();
    const before = await source.load();
    const forceps = before.items.find((i) => i.name === 'DeBakey forceps')!;
    await source.propose({
      department_id: 'd-cvor', kind: 'edit', target: 'item', target_id: forceps.id,
      data: { sub_location: 'Bin 5' }, base_version: 1,
    });
    const data = await source.load();
    const mine = data.requests.filter((r) => r.proposed_by === DEMO_USER_ID);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: 'pending', target: 'item', target_id: forceps.id, data: { sub_location: 'Bin 5' } });
    // A proposal does not change the item itself.
    expect(data.items.find((i) => i.id === forceps.id)!.sub_location).toBe('Bin 4');
  });

  it('makes a pending change request for the proposed preference card', async () => {
    const source = demoSource();
    await source.propose({
      department_id: 'd-main', kind: 'edit', target: 'card', target_id: 'c-chole',
      data: { notes: 'Bag on the back table.' }, base_version: 1,
    });
    const data = await source.load();
    expect(data.requests.find((r) => r.proposed_by === DEMO_USER_ID)).toMatchObject({
      status: 'pending', target: 'card', target_id: 'c-chole', department_id: 'd-main',
    });
  });

  it('refuses a proposal for a department the user is not in', async () => {
    await expect(
      demoSource().propose({ department_id: 'd-heart-cvor', kind: 'add', target: 'item', target_id: null, data: { name: 'X' }, base_version: null }),
    ).rejects.toThrow("You don't have access to that department.");
  });

  it('approving an edit updates the item and its version', async () => {
    const source = demoSource();
    await expect(source.review('r-1', 'approve')).resolves.toBe('approved');
    const data = await source.load();
    const cannula = data.items.find((i) => i.name === 'Cardioplegia cannula')!;
    expect(cannula).toMatchObject({ sub_location: 'Bin 14', notes: 'Moved next to the vents.', version: 2 });
    expect(data.requests.find((r) => r.id === 'r-1')!.status).toBe('approved');
  });

  it('approving an add puts the new item in the library', async () => {
    const source = demoSource();
    await source.review('r-2', 'approve');
    const data = await source.load();
    const shunt = data.items.find((i) => i.name === 'Coronary shunt 1.5 mm');
    expect(shunt).toMatchObject({ department_id: 'd-cvor', sub_location: 'Bin 15', version: 1 });
    expect(data.requests.find((r) => r.id === 'r-2')!.target_id).toBe(shunt!.id);
  });

  it('rejecting a change leaves the library as it was', async () => {
    const source = demoSource();
    await expect(source.review('r-1', 'reject')).resolves.toBe('rejected');
    const data = await source.load();
    expect(data.items.find((i) => i.name === 'Cardioplegia cannula')).toMatchObject({ sub_location: 'Bin 12', version: 1 });
    expect(data.requests.find((r) => r.id === 'r-1')!.status).toBe('rejected');
  });

  it('refuses to review a change twice, or your own change', async () => {
    const source = demoSource();
    await source.review('r-1', 'reject');
    await expect(source.review('r-1', 'approve')).rejects.toThrow('This change was already rejected.');
    await source.propose({ department_id: 'd-main', kind: 'edit', target: 'card', target_id: 'c-chole', data: { notes: 'x' }, base_version: 1 });
    const own = (await source.load()).requests.find((r) => r.proposed_by === DEMO_USER_ID)!;
    await expect(source.review(own.id, 'approve')).rejects.toThrow('You cannot review your own change. Ask a colleague.');
  });

  it('has no saved phone copy', async () => {
    await expect(demoSource().savedCopy()).resolves.toBeNull();
  });

  it('explains an error with its plain message', () => {
    const source = demoSource();
    expect(source.explainError(new Error('You cannot review your own change. Ask a colleague.'))).toBe(
      'You cannot review your own change. Ask a colleague.',
    );
    expect(source.explainError('Something odd')).toBe('Something odd');
  });
});
