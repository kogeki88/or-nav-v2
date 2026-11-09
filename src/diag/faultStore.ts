// Fault log on the phone: table fault_log in ornav.db (migration v2), newest 500 entries.
// logFault never throws and never waits the caller: a broken log must not break the app.
import { serial } from '../db/libraryStore';
import { installedVersion } from '../updater';
import { FaultArea, FaultEntry, FaultLevel, MAX_ENTRIES, makeEntry } from './faultLog';

/** A crash can end the app before a database write finishes, so it is first kept here (a quick, synchronous save). */
const CRASH_KEY = 'ornav.lastCrash';

function save(entry: FaultEntry): Promise<void> {
  return serial(async (db) => {
    await db.runAsync(
      'INSERT INTO fault_log (at, level, area, message, detail, app_version) VALUES (?, ?, ?, ?, ?, ?)',
      entry.at,
      entry.level,
      entry.area,
      entry.message,
      entry.detail,
      entry.app_version,
    );
    await db.runAsync('DELETE FROM fault_log WHERE id NOT IN (SELECT id FROM fault_log ORDER BY id DESC LIMIT ?)', MAX_ENTRIES);
  });
}

/**
 * Records a fault. Pass the caught error only: never omnibar message text or anything the user typed.
 * Call it in every catch block that hides an error from the user.
 */
export function logFault(area: FaultArea, e: unknown, level: FaultLevel = 'error'): void {
  try {
    const entry = makeEntry(level, area, e, installedVersion());
    if (__DEV__) console.warn(`[fault] ${area}: ${entry.message}`);
    save(entry).catch(() => undefined);
  } catch {
    // Never let logging break the app.
  }
}

/** Keeps a crash synchronously, so it survives the app closing. */
export function keepCrash(e: unknown): void {
  try {
    localStorage.setItem(CRASH_KEY, JSON.stringify(makeEntry('error', 'crash', e, installedVersion())));
  } catch {
    // Nothing more we can do.
  }
}

/** On start: moves a kept crash into the log. */
export async function moveKeptCrash(): Promise<void> {
  try {
    const raw = localStorage.getItem(CRASH_KEY);
    if (!raw) return;
    await save(JSON.parse(raw) as FaultEntry);
    localStorage.removeItem(CRASH_KEY);
  } catch {
    // Try again next start.
  }
}

/** Newest first. */
export function readFaults(limit = MAX_ENTRIES): Promise<FaultEntry[]> {
  return serial((db) =>
    db.getAllAsync<FaultEntry>('SELECT at, level, area, message, detail, app_version FROM fault_log ORDER BY id DESC LIMIT ?', limit),
  );
}

/** First department this user belongs to in the phone copy (for the omnibar test), or null. */
export function firstDepartment(userId: string): Promise<string | null> {
  return serial(async (db) => {
    const row = await db.getFirstAsync<{ department_id: string }>(
      'SELECT department_id FROM memberships WHERE user_id = ? ORDER BY department_id LIMIT 1',
      userId,
    );
    return row?.department_id ?? null;
  });
}
