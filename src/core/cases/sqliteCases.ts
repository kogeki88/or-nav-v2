// Cases in the phone's own database (ornav.db, table `cases`, migration v3), through serial().
// Saved on the phone only: nothing here talks to the server. Each account sees only its own cases.
import { serial } from '../../db/libraryStore';
import type { CaseStore } from '../../contracts/cases';
import { CaseRows, makeCaseStore } from './caseStore';
import type { CaseRow } from './rows';

const COLS = 'id, created_at, last_used_at, surgeon, procedure, card_id, set_by_nurse, messages';

export function sqliteCaseRows(userId: string): CaseRows {
  return {
    all: () => serial((db) => db.getAllAsync<CaseRow>(`SELECT ${COLS} FROM cases WHERE user_id = ? ORDER BY last_used_at DESC`, userId)),
    get: (id) =>
      serial(async (db) => (await db.getFirstAsync<CaseRow>(`SELECT ${COLS} FROM cases WHERE id = ? AND user_id = ?`, id, userId)) ?? null),
    put: (r, drop) =>
      serial((db) =>
        db.withTransactionAsync(async () => {
          await db.runAsync(
            `INSERT OR REPLACE INTO cases (user_id, ${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            userId,
            r.id,
            r.created_at,
            r.last_used_at,
            r.surgeon,
            r.procedure,
            r.card_id,
            r.set_by_nurse,
            r.messages,
          );
          for (const id of drop) await db.runAsync('DELETE FROM cases WHERE id = ? AND user_id = ?', id, userId);
        }),
      ),
  };
}

export function sqliteCaseStore(userId: string): CaseStore {
  return makeCaseStore(sqliteCaseRows(userId));
}
