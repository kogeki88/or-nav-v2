// The phone's own library database: table layout and row conversion.
// Pure TypeScript (no Expo imports), so Node can test it.
import type { Card, CardItem, ChangeRequest, Department, Hospital, Item, LibraryData, Membership } from '../contracts/library';

export type Migration = { version: number; sql: string };

/** Numbered, append-only. Never edit a migration that has shipped: add a new one. */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE hospitals (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, city TEXT);
CREATE TABLE departments (id TEXT PRIMARY KEY NOT NULL, hospital_id TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE memberships (user_id TEXT NOT NULL, department_id TEXT NOT NULL, job_role TEXT, PRIMARY KEY (user_id, department_id));
CREATE TABLE items (
  id TEXT PRIMARY KEY NOT NULL, department_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT,
  shelf TEXT, sub_location TEXT, synonyms TEXT NOT NULL DEFAULT '[]', notes TEXT, photo_path TEXT,
  version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX items_department ON items (department_id);
CREATE TABLE preference_cards (
  id TEXT PRIMARY KEY NOT NULL, department_id TEXT NOT NULL, surgeon TEXT NOT NULL, procedure TEXT NOT NULL,
  specialty TEXT, notes TEXT, version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX cards_department ON preference_cards (department_id);
CREATE TABLE card_items (
  id TEXT PRIMARY KEY NOT NULL, department_id TEXT NOT NULL, card_id TEXT NOT NULL, item_id TEXT NOT NULL,
  phase TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, open_or_hold TEXT NOT NULL DEFAULT 'open',
  note TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE INDEX card_items_card ON card_items (card_id);
CREATE TABLE change_requests (
  id TEXT PRIMARY KEY NOT NULL, department_id TEXT NOT NULL, proposed_by TEXT NOT NULL, kind TEXT NOT NULL,
  target TEXT NOT NULL, target_id TEXT, data TEXT NOT NULL DEFAULT '{}', base_version INTEGER,
  status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`,
  },
  {
    // Fault log (src/diag). Not a library table: a server load never empties it.
    version: 2,
    sql: `
CREATE TABLE fault_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, level TEXT NOT NULL, area TEXT NOT NULL,
  message TEXT NOT NULL, detail TEXT, app_version TEXT NOT NULL);
`,
  },
  {
    // Cases (src/core/cases): the one box's conversations, on the phone only, per user. Not a library table.
    version: 3,
    sql: `
CREATE TABLE cases (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, last_used_at TEXT NOT NULL,
  surgeon TEXT, procedure TEXT, card_id TEXT, set_by_nurse INTEGER NOT NULL DEFAULT 0,
  messages TEXT NOT NULL DEFAULT '[]');
CREATE INDEX cases_user_last_used ON cases (user_id, last_used_at);
`,
  },
  {
    // Feedback outbox (src/core/feedback): reports wait here until sent (sent_at) or refused for good
    // by the server (refused_at). Not a library table.
    version: 4,
    sql: `
CREATE TABLE feedback_outbox (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, app_version TEXT NOT NULL,
  page TEXT NOT NULL, tag TEXT NOT NULL, message TEXT NOT NULL, sent_at TEXT, refused_at TEXT);
CREATE INDEX feedback_outbox_waiting ON feedback_outbox (user_id, sent_at, refused_at, created_at);
`,
  },
  {
    // Ticket #23: the uri of the report's screenshot on the phone, kept while the report waits.
    version: 5,
    sql: `
ALTER TABLE feedback_outbox ADD COLUMN screenshot TEXT;
`,
  },
  {
    // Ticket #32: the picture's bucket path once it is up, so a retry sends only the row.
    version: 6,
    sql: `
ALTER TABLE feedback_outbox ADD COLUMN picture_path TEXT;
`,
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** Migrations still to run, in order, for a database at `current`. */
export function pendingMigrations(current: number): Migration[] {
  return MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
}

/** Tables the library copy fills, in delete-safe order. */
export const LIBRARY_TABLES = [
  'change_requests',
  'card_items',
  'preference_cards',
  'items',
  'memberships',
  'departments',
  'hospitals',
] as const;

type Value = string | number | null;
export type Insert = { sql: string; params: Value[] };

function insert(table: string, cols: string[], values: Value[]): Insert {
  return { sql: `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, params: values };
}

/** Every INSERT needed to store `data` (run inside one transaction, after the tables are emptied). */
export function libraryInserts(data: LibraryData): Insert[] {
  const out: Insert[] = [];
  for (const h of data.hospitals) out.push(insert('hospitals', ['id', 'name', 'city'], [h.id, h.name, h.city]));
  for (const d of data.departments) out.push(insert('departments', ['id', 'hospital_id', 'name'], [d.id, d.hospital_id, d.name]));
  for (const m of data.memberships)
    out.push(insert('memberships', ['user_id', 'department_id', 'job_role'], [m.user_id, m.department_id, m.job_role]));
  for (const i of data.items)
    out.push(
      insert(
        'items',
        ['id', 'department_id', 'name', 'category', 'shelf', 'sub_location', 'synonyms', 'notes', 'photo_path', 'version'],
        [i.id, i.department_id, i.name, i.category, i.shelf, i.sub_location, JSON.stringify(i.synonyms ?? []), i.notes, i.photo_path, i.version],
      ),
    );
  for (const c of data.cards)
    out.push(
      insert(
        'preference_cards',
        ['id', 'department_id', 'surgeon', 'procedure', 'specialty', 'notes', 'version'],
        [c.id, c.department_id, c.surgeon, c.procedure, c.specialty, c.notes, c.version],
      ),
    );
  for (const ci of data.cardItems)
    out.push(
      insert(
        'card_items',
        ['id', 'department_id', 'card_id', 'item_id', 'phase', 'quantity', 'open_or_hold', 'note', 'sort_order'],
        [ci.id, ci.department_id, ci.card_id, ci.item_id, ci.phase, ci.quantity, ci.open_or_hold, ci.note, ci.sort_order],
      ),
    );
  for (const r of data.requests)
    out.push(
      insert(
        'change_requests',
        ['id', 'department_id', 'proposed_by', 'kind', 'target', 'target_id', 'data', 'base_version', 'status', 'created_at'],
        [r.id, r.department_id, r.proposed_by, r.kind, r.target, r.target_id, JSON.stringify(r.data ?? {}), r.base_version, r.status, r.created_at],
      ),
    );
  return out;
}

function parseJson<T>(text: unknown, fallback: T): T {
  if (typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

type ItemRow = Omit<Item, 'synonyms'> & { synonyms: string };
type RequestRow = Omit<ChangeRequest, 'data'> & { data: string };

export type LibraryRows = {
  hospitals: Hospital[];
  departments: Department[];
  memberships: Membership[];
  items: ItemRow[];
  cards: Card[];
  cardItems: CardItem[];
  requests: RequestRow[];
  loadedAt: string;
};

/** Rows read back from SQLite → the shape the screens use. */
export function fromRows(r: LibraryRows): LibraryData {
  return {
    hospitals: r.hospitals,
    departments: r.departments,
    memberships: r.memberships,
    items: r.items.map((i) => ({ ...i, synonyms: parseJson<string[]>(i.synonyms, []) })),
    cards: r.cards,
    cardItems: r.cardItems,
    requests: r.requests.map((q) => ({ ...q, data: parseJson<Record<string, unknown>>(q.data, {}) })),
    loadedAt: r.loadedAt,
  };
}
