// Demo mode: made-up sample data in memory, with the same rules as the server.
// Used only for emulator screenshots (EXPO_PUBLIC_DEMO=1 in a development run). No patient data.
import type { Card, CardItem, ChangeRequest, Item, LibraryData, LibrarySource } from '../../contracts/library';

export const DEMO_USER_ID = 'demo-user';
const COLLEAGUE = 'demo-colleague';

const H1 = 'h-sample', H2 = 'h-heart';
const D1 = 'd-main', D2 = 'd-cvor', D3 = 'd-heart-cvor';

let seq = 100;
const id = (p: string) => `${p}-${++seq}`;
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

function item(dept: string, name: string, category: string, shelf: string, spot: string, synonyms: string[] = [], notes: string | null = null): Item {
  return { id: id('i'), department_id: dept, name, category, shelf, sub_location: spot, synonyms, notes, photo_path: null, version: 1 };
}

function build(): LibraryData {
  const items: Item[] = [
    item(D2, 'DeBakey forceps', 'Instrument', 'Core B · Shelf 2', 'Bin 4', ['Debakeys', 'DB forceps'], 'Long set on the top tray.'),
    item(D2, 'Aortic punch 4.0 mm', 'Instrument', 'Core B · Shelf 3', 'Bin 1', ['Punch']),
    item(D2, '4-0 Prolene', 'Suture', 'Suture cart', 'Drawer 2', ['Prolene 4-0', 'Polypropylene']),
    item(D2, 'Cardioplegia cannula', 'Supply', 'CVOR core', 'Bin 12', ['Antegrade cannula']),
    item(D2, 'Sternal saw blade', 'Supply', 'CVOR core', 'Bin 3', ['Stryker blade']),
    item(D2, 'Bulldog clamps', 'Instrument', 'Core B · Shelf 2', 'Bin 6', ['Bulldogs']),
    item(D1, 'Maryland dissector', 'Instrument', 'Lap cart', 'Drawer 1', ['Maryland']),
    item(D1, 'Hem-o-lok clips, large', 'Supply', 'Main core', 'Bin 22', ['Hemolock', 'Purple clips']),
    item(D1, 'Endo Catch bag', 'Supply', 'Main core', 'Bin 9', ['Specimen bag']),
    item(D1, '0 Vicryl CT-1', 'Suture', 'Suture cart', 'Drawer 4', ['Vicryl 0']),
    item(D3, 'Sternal retractor', 'Instrument', 'Heart core', 'Shelf A', ['Finochietto']),
  ];
  const find = (name: string) => items.find((i) => i.name === name)!.id;
  const cards: Card[] = [
    { id: 'c-cabg', department_id: D2, surgeon: 'Dr. Patel', procedure: 'CABG x3', specialty: 'Cardiac', notes: 'Prefers 4-0 Prolene for the proximals.', version: 2 },
    { id: 'c-avr', department_id: D2, surgeon: 'Dr. Okafor', procedure: 'AVR', specialty: 'Cardiac', notes: null, version: 1 },
    { id: 'c-chole', department_id: D1, surgeon: 'Dr. Kim', procedure: 'Lap chole', specialty: 'General', notes: 'Open the bag only on request.', version: 1 },
  ];
  const line = (card: string, dept: string, name: string, phase: CardItem['phase'], quantity: number, open: 'open' | 'hold', sort: number): CardItem => ({
    id: id('l'), department_id: dept, card_id: card, item_id: find(name), phase, quantity, open_or_hold: open, note: null, sort_order: sort,
  });
  const cardItems: CardItem[] = [
    line('c-cabg', D2, 'Sternal saw blade', 'Setup', 1, 'open', 1),
    line('c-cabg', D2, 'DeBakey forceps', 'Setup', 2, 'open', 2),
    line('c-cabg', D2, 'Bulldog clamps', 'Cannulation/Main', 4, 'open', 3),
    line('c-cabg', D2, 'Cardioplegia cannula', 'Cannulation/Main', 1, 'open', 4),
    line('c-cabg', D2, 'Aortic punch 4.0 mm', 'Cannulation/Main', 1, 'hold', 5),
    line('c-cabg', D2, '4-0 Prolene', 'Closure', 6, 'open', 6),
    line('c-avr', D2, 'DeBakey forceps', 'Setup', 2, 'open', 1),
    line('c-chole', D1, 'Maryland dissector', 'Setup', 1, 'open', 1),
    line('c-chole', D1, 'Hem-o-lok clips, large', 'Incision', 1, 'open', 2),
    line('c-chole', D1, 'Endo Catch bag', 'Closure', 1, 'hold', 3),
    line('c-chole', D1, '0 Vicryl CT-1', 'Closure', 2, 'open', 4),
  ];
  const requests: ChangeRequest[] = [
    {
      id: 'r-1', department_id: D2, proposed_by: COLLEAGUE, kind: 'edit', target: 'item', target_id: find('Cardioplegia cannula'),
      data: { sub_location: 'Bin 14', notes: 'Moved next to the vents.' }, base_version: 1, status: 'pending', created_at: ago(42),
    },
    {
      id: 'r-2', department_id: D2, proposed_by: COLLEAGUE, kind: 'add', target: 'item', target_id: null,
      data: { name: 'Coronary shunt 1.5 mm', category: 'Supply', shelf: 'CVOR core', sub_location: 'Bin 15', synonyms: ['Shunt'] },
      base_version: null, status: 'pending', created_at: ago(180),
    },
  ];
  return {
    hospitals: [
      { id: H1, name: 'Sample General Hospital', city: 'Springfield' },
      { id: H2, name: 'Demo Heart Center', city: 'Riverside' },
    ],
    departments: [
      { id: D1, hospital_id: H1, name: 'Main OR' },
      { id: D2, hospital_id: H1, name: 'CVOR / Cardiac OR' },
      { id: 'd-heart-main', hospital_id: H2, name: 'Main OR' },
      { id: D3, hospital_id: H2, name: 'CVOR / Cardiac OR' },
    ],
    memberships: [
      { user_id: DEMO_USER_ID, department_id: D2, job_role: 'Scrub nurse' },
      { user_id: DEMO_USER_ID, department_id: D1, job_role: 'Scrub nurse' },
      { user_id: COLLEAGUE, department_id: D2, job_role: 'Circulating nurse' },
    ],
    items,
    cards,
    cardItems,
    requests,
    loadedAt: new Date().toISOString(),
  };
}

function apply(db: LibraryData, r: ChangeRequest): string {
  const d = r.data as Record<string, never>;
  const list = r.target === 'item' ? db.items : r.target === 'card' ? db.cards : db.cardItems;
  if (r.kind === 'add') {
    const row = { id: id(r.target), department_id: r.department_id, version: 1, synonyms: [], ...d } as never;
    (list as unknown[]).push(row);
    return (row as { id: string }).id;
  }
  const i = (list as { id: string; department_id: string; version?: number }[]).findIndex((x) => x.id === r.target_id && x.department_id === r.department_id);
  const row = list[i] as { version?: number } | undefined;
  if (i < 0 || (r.base_version !== null && row?.version !== r.base_version)) {
    throw new Error('Not found in this department, or someone changed it first. Reload and try again.');
  }
  if (r.kind === 'remove') {
    if (r.target === 'item' && db.cardItems.some((ci) => ci.item_id === r.target_id)) {
      throw new Error('This item is on a preference card. Remove it from the cards first.');
    }
    list.splice(i, 1);
  } else {
    Object.assign(row as object, d, { version: (row?.version ?? 1) + 1 });
  }
  return r.target_id!;
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function demoSource(): LibrarySource {
  const db = build();
  const isMember = (dept: string) => db.memberships.some((m) => m.user_id === DEMO_USER_ID && m.department_id === dept);
  const visible = (): LibraryData => {
    const mine = (x: { department_id: string }) => isMember(x.department_id);
    return {
      ...db,
      memberships: db.memberships.filter((m) => m.user_id === DEMO_USER_ID || isMember(m.department_id)),
      items: db.items.filter(mine),
      cards: db.cards.filter(mine),
      cardItems: db.cardItems.filter(mine),
      requests: db.requests.filter(mine),
      loadedAt: new Date().toISOString(),
    };
  };
  return {
    async load() {
      await wait(350);
      return structuredClone(visible());
    },
    async join(dept, jobRole) {
      await wait(250);
      if (!isMember(dept)) db.memberships.push({ user_id: DEMO_USER_ID, department_id: dept, job_role: jobRole });
    },
    async leave(dept) {
      await wait(250);
      db.memberships = db.memberships.filter((m) => !(m.user_id === DEMO_USER_ID && m.department_id === dept));
    },
    async propose(change) {
      await wait(300);
      if (!isMember(change.department_id)) throw new Error("You don't have access to that department.");
      db.requests.unshift({ ...change, id: id('r'), proposed_by: DEMO_USER_ID, status: 'pending', created_at: new Date().toISOString() });
    },
    async review(requestId, decision) {
      await wait(300);
      const r = db.requests.find((x) => x.id === requestId);
      if (!r) throw new Error('Change request not found.');
      if (r.status !== 'pending') throw new Error(`This change was already ${r.status}.`);
      if (r.proposed_by === DEMO_USER_ID) throw new Error('You cannot review your own change. Ask a colleague.');
      if (!isMember(r.department_id)) throw new Error('You are not a member of this department.');
      if (decision === 'approve') {
        r.target_id = apply(db, r);
        r.status = 'approved';
        return 'approved';
      }
      r.status = 'rejected';
      return 'rejected';
    },
    async savedCopy() {
      return null;
    },
    explainError(e) {
      return e instanceof Error ? e.message : String(e);
    },
  };
}
