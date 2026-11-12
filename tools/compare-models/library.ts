// The Sample General Hospital / Main OR library, read from the seed file (supabase/seed/sample_main_or.sql),
// with made-up fixed ids. Test data only: no patient data.
import { readFileSync } from 'node:fs';

const SEED = 'supabase/seed/sample_main_or.sql';
const sql = readFileSync(SEED, 'utf8');

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const str = (v: string) => (v === 'null' ? null : v.replace(/^'|'$/g, ''));

const deptId = uuid();
const cvorId = uuid();

const items = [...sql.matchAll(/\(dept, '([^']*)', '([^']*)', '([^']*)', '([^']*)', '\{([^}]*)\}', (null|'[^']*')\)/g)].map((m) => ({
  id: uuid(),
  department_id: deptId,
  name: m[1],
  category: m[2],
  shelf: m[3],
  sub_location: m[4],
  synonyms: m[5] ? m[5].split(',') : [],
  notes: str(m[6]),
  photo_path: null,
  version: 1,
}));

const cardVars = new Map<string, string>();
const cards = [...sql.matchAll(/values \(dept, '([^']*)', '([^']*)', '([^']*)', (null|'[^']*')\)\s*returning id into (c_\w+)/g)].map((m) => {
  const id = uuid();
  cardVars.set(m[5], id);
  return { id, department_id: deptId, surgeon: m[1], procedure: m[2], specialty: m[3], notes: str(m[4]), version: 1 };
});

const cardItems = [...sql.matchAll(/\((c_\w+), '([^']*)', '([^']*)', (\d+), '(open|hold)', (\d+)\)/g)].map((m) => ({
  id: uuid(),
  department_id: deptId,
  card_id: cardVars.get(m[1])!,
  item_id: items.find((i) => i.name === m[2])!.id,
  phase: m[3],
  quantity: Number(m[4]),
  open_or_hold: m[5],
  note: null,
  sort_order: Number(m[6]),
}));

if (items.length !== 16 || cards.length !== 3 || cardItems.length !== 23) {
  throw new Error(`Seed read wrong: ${items.length} items, ${cards.length} cards, ${cardItems.length} lines (expect 16, 3, 23)`);
}

const MAIN = 'Sample General Hospital · Main OR';
const CVOR = 'Sample General Hospital · CVOR / Cardiac OR';

export const library = {
  deptId,
  myDeptIds: [deptId, cvorId],
  // Shaped like LibraryData; validActions reads only items, cards and cardItems.
  data: { hospitals: [], departments: [], memberships: [], requests: [], items, cards, cardItems } as never as {
    items: typeof items;
    cards: typeof cards;
    cardItems: typeof cardItems;
  } & Record<string, unknown>,
  contextInput: {
    departmentName: MAIN,
    myDepartments: [
      { id: deptId, label: MAIN },
      { id: cvorId, label: CVOR },
    ],
    items,
    cards,
    cardItems,
  },
};
