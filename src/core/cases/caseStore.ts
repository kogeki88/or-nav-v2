// The case store (the cases port) over a plain table of rows: SQLite on the phone, memory in tests.
import type { Case, CaseStore } from '../../contracts/cases';
import { CaseRow, fromCaseRow, toCaseRow } from './rows';
import { caseLabel, caseWhen, keepLast, pickOnOpen, toSave, worthSaving } from './rules';

/** The table the store keeps its rows in. */
export interface CaseRows {
  all(): Promise<CaseRow[]>;
  get(id: string): Promise<CaseRow | null>;
  /** Writes the row (insert or replace), then removes the `drop` ids, as one job. */
  put(row: CaseRow, drop: string[]): Promise<void>;
}

function newId(now: Date): string {
  return `case-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeCaseStore(rows: CaseRows): CaseStore {
  const listRecent = async () => keepLast((await rows.all()).map(fromCaseRow)).keep;

  const startNew = (now: Date): Case => ({
    id: newId(now),
    createdAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    surgeon: null,
    procedure: null,
    cardId: null,
    setByNurse: false,
    messages: [],
  });

  return {
    listRecent,
    async get(id) {
      const row = await rows.get(id);
      return row ? fromCaseRow(row) : null;
    },
    async save(c) {
      if (!worthSaving(c)) return listRecent();
      const keep = toSave(c);
      const others = (await rows.all()).map(fromCaseRow).filter((o) => o.id !== keep.id);
      const { drop } = keepLast([keep, ...others]);
      await rows.put(toCaseRow(keep), drop);
      return listRecent();
    },
    startNew,
    async openOnStart(now) {
      const recent = await listRecent();
      return { current: pickOnOpen(recent, now) ?? startNew(now), recent };
    },
    label: caseLabel,
    when: caseWhen,
  };
}

/** Rows in memory (tests and demo mode). */
export function memoryCaseRows(): CaseRows {
  const table = new Map<string, CaseRow>();
  return {
    all: async () => [...table.values()],
    get: async (id) => table.get(id) ?? null,
    put: async (row, drop) => {
      table.set(row.id, row);
      for (const id of drop) table.delete(id);
    },
  };
}
