// Fault log: pure rules for what a log entry holds and how a report is built.
// Pure TypeScript (no Expo imports), so Node can test it.
// Privacy: an entry holds only an error's own text, scrubbed. Never pass omnibar message text or user input here.
import { scrub } from '../../supabase/functions/omnibar/scrub';

export type FaultLevel = 'error' | 'warn' | 'info';
export type FaultArea = 'crash' | 'signin' | 'sync' | 'database' | 'update' | 'omnibar' | 'test';

export type FaultEntry = {
  at: string;
  level: FaultLevel;
  area: FaultArea;
  message: string;
  detail: string | null;
  app_version: string;
};

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type CheckResult = { name: string; status: CheckStatus; value: string };

/** The phone keeps only the newest entries. */
export const MAX_ENTRIES = 500;
/** A report sends at most this many of the newest entries. */
export const REPORT_ENTRIES = 200;
export const MAX_MESSAGE = 300;
export const MAX_DETAIL = 2000;

const REMOVED = '[removed: may hold patient information]';

/** Scrubs and shortens text. If the scrubber blocks it (a likely name or birth date), the text is dropped. */
export function cleanText(text: string, max: number): string {
  const r = scrub(text);
  const out = r.ok ? r.text : REMOVED;
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

/** The message and stack of any thrown value. */
export function errorParts(e: unknown): { message: string; detail: string | null } {
  if (e instanceof Error) return { message: `${e.name === 'Error' ? '' : `${e.name}: `}${e.message}`, detail: e.stack ?? null };
  if (typeof e === 'object' && e && 'message' in e) return { message: String((e as { message: unknown }).message), detail: null };
  return { message: String(e), detail: null };
}

/** No internet is normal in the OR: it is kept as 'info', so it does not count as an error. */
export function isNetworkError(message: string): boolean {
  return /network request failed|failed to fetch|fetch failed|failed to send a request|unknownhost|unable to resolve host|can't reach|network ?error|offline|no internet|timed? ?out|no answer in/i.test(message);
}

export function makeEntry(level: FaultLevel, area: FaultArea, e: unknown, appVersion: string, now = new Date()): FaultEntry {
  const { message, detail } = errorParts(e);
  return {
    at: now.toISOString(),
    level: level !== 'info' && isNetworkError(message) ? 'info' : level,
    area,
    message: cleanText(message || '(no message)', MAX_MESSAGE),
    detail: detail ? cleanText(detail, MAX_DETAIL) : null,
    app_version: appVersion,
  };
}

/** Errors in the last 24 hours. */
export function recentErrors(entries: FaultEntry[], now = new Date()): number {
  const since = now.getTime() - 24 * 60 * 60 * 1000;
  return entries.filter((x) => x.level === 'error' && new Date(x.at).getTime() >= since).length;
}

export type FaultReport = { app_version: string; build: string; checks: CheckResult[]; entries: FaultEntry[] };

/** What "Send report" uploads: the check lines and the newest entries (entries come newest first). */
export function buildReport(appVersion: string, build: string, checks: CheckResult[], entries: FaultEntry[]): FaultReport {
  return { app_version: appVersion, build, checks, entries: entries.slice(0, REPORT_ENTRIES) };
}
