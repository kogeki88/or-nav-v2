// The phone's own library database (ornav.db, SQLite in WAL mode).
// It holds the last copy the server sent, so the Library opens with no signal in the OR.
import * as SQLite from 'expo-sqlite';

import type { LibraryData } from '../contracts/library';
import { LATEST_VERSION, LIBRARY_TABLES, LibraryRows, fromRows, libraryInserts, pendingMigrations } from './schema';

let ready: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('ornav.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);');
  const row = await db.getFirstAsync<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations');
  for (const m of pendingMigrations(row?.v ?? 0)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', m.version, new Date().toISOString());
    });
  }
  return db;
}

/** One shared connection; migrations run once, on first use. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!ready) {
    ready = open().catch((e) => {
      ready = null; // Try again next time.
      throw e;
    });
  }
  return ready;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs database jobs one at a time, so a read never lands inside a save's transaction.
 * Note: on Android, database calls wait while expo-file-system downloads an update APK
 * (shared native worker). They finish once the download ends.
 */
export function serial<T>(job: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = queue.then(async () => job(await getDb()));
  queue = run.catch(() => undefined);
  return run;
}

/** Replaces the whole phone copy in one transaction: all of it is saved, or none of it. */
export function saveLibrary(userId: string, data: LibraryData): Promise<void> {
  const inserts = libraryInserts(data);
  return serial((db) =>
    // A plain transaction on the one connection. serial() makes sure nothing else runs inside it.
    // (withExclusiveTransactionAsync opened a second connection, and the main one then stalled on Android.)
    db.withTransactionAsync(async () => {
      for (const t of LIBRARY_TABLES) await db.runAsync(`DELETE FROM ${t}`);
      for (const ins of inserts) await db.runAsync(ins.sql, ins.params);
      await db.runAsync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('user_id', ?)", userId);
      await db.runAsync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('loaded_at', ?)", data.loadedAt);
    }),
  );
}

async function meta(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', key);
  return row?.value ?? null;
}

/** The saved copy, or null if there is none for this user (another account's copy is never shown). */
export function readLibrary(userId: string): Promise<LibraryData | null> {
  return serial((db) => readLibraryNow(db, userId));
}

async function readLibraryNow(db: SQLite.SQLiteDatabase, userId: string): Promise<LibraryData | null> {
  if ((await meta(db, 'user_id')) !== userId) return null;
  const rows: LibraryRows = {
    hospitals: await db.getAllAsync('SELECT id, name, city FROM hospitals ORDER BY name'),
    departments: await db.getAllAsync('SELECT id, hospital_id, name FROM departments ORDER BY name'),
    memberships: await db.getAllAsync('SELECT user_id, department_id, job_role FROM memberships'),
    items: await db.getAllAsync('SELECT * FROM items'),
    cards: await db.getAllAsync('SELECT * FROM preference_cards'),
    cardItems: await db.getAllAsync('SELECT * FROM card_items'),
    requests: await db.getAllAsync('SELECT * FROM change_requests ORDER BY created_at DESC'),
    loadedAt: (await meta(db, 'loaded_at')) ?? '',
  };
  return fromRows(rows);
}

export type DbHealth = {
  schemaVersion: number;
  latestVersion: number;
  counts: { items: number; cards: number; cardItems: number; requests: number; departments: number };
  sizeBytes: number;
  loadedAt: string | null;
};

/** Numbers for the Admin view: schema version, row counts, file size, last sync. */
export function dbHealth(): Promise<DbHealth> {
  return serial(dbHealthNow);
}

const HEALTH_SQL = `SELECT
  (SELECT MAX(version) FROM schema_migrations) AS version,
  (SELECT COUNT(*) FROM items) AS items,
  (SELECT COUNT(*) FROM preference_cards) AS cards,
  (SELECT COUNT(*) FROM card_items) AS card_items,
  (SELECT COUNT(*) FROM change_requests) AS requests,
  (SELECT COUNT(*) FROM memberships WHERE user_id = (SELECT value FROM sync_meta WHERE key = 'user_id')) AS departments,
  (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS size,
  (SELECT value FROM sync_meta WHERE key = 'loaded_at') AS loaded_at`;

type HealthRow = {
  version: number | null;
  items: number;
  cards: number;
  card_items: number;
  requests: number;
  departments: number;
  size: number;
  loaded_at: string | null;
};

async function dbHealthNow(db: SQLite.SQLiteDatabase): Promise<DbHealth> {
  const r = await db.getFirstAsync<HealthRow>(HEALTH_SQL);
  return {
    schemaVersion: r?.version ?? 0,
    latestVersion: LATEST_VERSION,
    counts: {
      items: r?.items ?? 0,
      cards: r?.cards ?? 0,
      cardItems: r?.card_items ?? 0,
      requests: r?.requests ?? 0,
      departments: r?.departments ?? 0,
    },
    sizeBytes: r?.size ?? 0,
    loadedAt: r?.loaded_at ?? null,
  };
}
