// The feedback outbox (the feedback port): every report is saved on the phone before any network call,
// then uploaded. Waiting reports go out on flush (app start, return to the app, after each submit),
// and, with retryMs, on a timed retry while any report waits, so they leave when the signal comes back.
// The id is made on the phone once, so a retry after an unknown result never makes a second row.
// A report the server refuses for good is marked refused, so it never blocks the reports after it.
// Never logs the message text.
import type { FeedbackResult, FeedbackSender } from '../../contracts/feedback';

/** One report, as saved on the phone and sent to `feedback_reports`. */
export type FeedbackRow = {
  id: string;
  created_at: string;
  app_version: string;
  page: string;
  tag: string;
  message: string;
  /** The phone's own copy of the screenshot (a local file uri), or none. Ticket #23. */
  screenshot?: string | null;
  /**
   * The picture's path in the bucket once it is up, while the row still waits (ticket #32).
   * Set: a retry goes straight to the row insert, so a weak signal never uploads the picture twice.
   */
  picture_path?: string | null;
};

/** The phone's table of reports (SQLite in the app, memory in tests). */
export interface OutboxRows {
  add(row: FeedbackRow): Promise<void>;
  /** Reports not sent and not refused, oldest first. */
  waiting(): Promise<FeedbackRow[]>;
  /** Sets sent_at and clears the message text and screenshot: the phone keeps no copy of a sent report (tickets #28, #23). */
  markSent(id: string, at: string): Promise<void>;
  /** The server refused it for good: never try it again. */
  markRefused(id: string, at: string): Promise<void>;
  /** The picture is in the bucket at `path`; only the row is still to send (ticket #32). */
  markPictureUp(id: string, path: string): Promise<void>;
}

/**
 * `ok` also when the server already has this id (an earlier try arrived). `retry` false = refused for good.
 * `picturePath`: this try put the picture up, at this bucket path, before the failure.
 */
export type UploadResult = { ok: true } | { ok: false; error: unknown; retry: boolean; picturePath?: string };
export type Uploader = (row: FeedbackRow) => Promise<UploadResult>;

export type OutboxDeps = {
  appVersion: () => string;
  /** The signed-in user's role. Only "admin" may send. */
  role: () => string | null;
  /** Pass logFault: it gets the error only. */
  onFault: (e: unknown) => void;
  now?: () => Date;
  /** How long submit waits for the network before it answers "saved" (the report is safe either way). */
  waitMs?: number;
  /**
   * While a report waits for signal, try again after this many ms, so it goes out when the signal
   * comes back with no app restart (ticket #27). The timer stops once nothing waits. Off when unset.
   */
  retryMs?: number;
  /**
   * Moves the screenshot from the cache into the app's own folder under the report id, so it stays
   * with the waiting report after a restart. Gives the new uri. Unset: the draft's uri is kept as is.
   */
  keepScreenshot?: (from: string, id: string) => Promise<string>;
  /** Removes the phone's copy of a sent report's screenshot; the bucket keeps its copy (Homunculus, ticket #23). */
  dropScreenshot?: (uri: string) => Promise<void>;
};

/** The server's limit on `feedback_reports.message` (migration 0005). */
export const MAX_MESSAGE = 4000;

/** A random version-4 uuid (the table's primary key). */
export function newReportId(random: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16));
  hex[12] = 4;
  hex[16] = 8 + (hex[16] % 4);
  const s = hex.map((n) => n.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

type Outcome = { kind: 'sent' } | { kind: 'refused'; reason: string };

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function makeFeedbackOutbox(rows: OutboxRows, upload: Uploader, deps: OutboxDeps): FeedbackSender {
  const now = deps.now ?? (() => new Date());
  const waitMs = deps.waitMs ?? 8000;
  // One flush at a time, so two flushes never upload the same report together.
  let running: Promise<unknown> = Promise.resolve();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  // A report is still waiting for signal: try again later, unless a try is already planned.
  const planRetry = () => {
    if (deps.retryMs === undefined || closed || retryTimer !== undefined) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void runFlush(true);
    }, deps.retryMs);
  };

  const dropPicture = async (row: FeedbackRow) => {
    if (row.screenshot && deps.dropScreenshot) await deps.dropScreenshot(row.screenshot).catch(deps.onFault);
  };

  // `timed`: a timed retry. Its no-signal failures are not logged again, so hours offline
  // never push the other entries out of the fault log (it keeps the newest 500).
  const flushNow = async (timed: boolean): Promise<Map<string, Outcome>> => {
    const outcomes = new Map<string, Outcome>();
    if (closed) return outcomes;
    let waiting: FeedbackRow[];
    try {
      waiting = await rows.waiting();
    } catch (e) {
      deps.onFault(e);
      return outcomes;
    }
    for (const row of waiting) {
      const result = await upload(row).catch((e: unknown): UploadResult => ({ ok: false, error: e, retry: true }));
      if (!result.ok) {
        if (!(timed && result.retry)) deps.onFault(result.error);
        if (result.retry) {
          // The picture is up: note it on the phone, so the retry sends only the row (ticket #32).
          if (result.picturePath) {
            await rows.markPictureUp(row.id, result.picturePath).catch(deps.onFault);
          }
          planRetry(); // No signal: try again in a while, and on the next start, return or send.
          break;
        }
        outcomes.set(row.id, { kind: 'refused', reason: reasonOf(result.error) });
        await rows.markRefused(row.id, now().toISOString()).catch(deps.onFault);
        await dropPicture(row); // It can never be sent.
        continue;
      }
      outcomes.set(row.id, { kind: 'sent' });
      // The server has the row (and the picture): the phone's copy goes first, so no file is ever left
      // that no row points to. If markSent then fails, the next flush tries again; the server answers
      // "already there" for the row, so nothing is made twice.
      await dropPicture(row);
      await rows.markSent(row.id, now().toISOString()).catch(deps.onFault);
    }
    return outcomes;
  };

  const runFlush = (timed = false): Promise<Map<string, Outcome>> => {
    const next = running.then(() => flushNow(timed));
    running = next.catch(() => undefined);
    return next;
  };

  return {
    flush: async () => {
      await runFlush();
    },
    close() {
      closed = true;
      clearTimeout(retryTimer);
      retryTimer = undefined;
    },
    async submit(draft): Promise<FeedbackResult> {
      if (deps.role() !== 'admin') return { kind: 'error', message: 'Only admins can send feedback.' };
      const message = draft.message.trim();
      if (message === '') return { kind: 'error', message: 'Type a message first.' };
      if (message.length > MAX_MESSAGE) return { kind: 'error', message: `Too long: keep it under ${MAX_MESSAGE} characters.` };
      const id = newReportId();
      let screenshot = draft.screenshot ?? null;
      if (screenshot && deps.keepScreenshot) {
        // A lost picture never stops the report: it goes without one.
        screenshot = await deps.keepScreenshot(screenshot, id).catch((e: unknown) => {
          deps.onFault(e);
          return null;
        });
      }
      const row: FeedbackRow = {
        id,
        created_at: now().toISOString(),
        app_version: deps.appVersion(),
        page: draft.page,
        tag: draft.tag,
        message,
        screenshot,
      };
      try {
        await rows.add(row);
      } catch (e) {
        deps.onFault(e);
        await dropPicture(row);
        return { kind: 'error', message: 'Not saved: the phone could not store the report. Try again.' };
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tooLong = new Promise<undefined>((done) => {
        timer = setTimeout(() => done(undefined), waitMs);
      });
      const outcome = await Promise.race([runFlush().then((m) => m.get(row.id)), tooLong]);
      clearTimeout(timer);
      if (outcome?.kind === 'sent') return { kind: 'sent' };
      if (outcome?.kind === 'refused') return { kind: 'error', message: `Not sent: ${outcome.reason}` };
      return { kind: 'saved' };
    },
  };
}

/** A report as the phone keeps it. A sent report keeps no message text (ticket #28). */
export type StoredFeedbackRow = FeedbackRow & { sent_at: string | null; refused_at: string | null };

/** Reports in memory (tests and demo mode). Works like the SQLite table, so `all()` shows what the phone keeps. */
export function memoryOutboxRows(): OutboxRows & { all(): StoredFeedbackRow[] } {
  const table: StoredFeedbackRow[] = [];
  const find = (id: string) => table.find((x) => x.id === id);
  return {
    add: async (row) => {
      table.push({ ...row, screenshot: row.screenshot ?? null, picture_path: row.picture_path ?? null, sent_at: null, refused_at: null });
    },
    waiting: async () =>
      table.filter((r) => r.sent_at === null && r.refused_at === null).map(({ sent_at: _s, refused_at: _r, ...r }) => r),
    markSent: async (id, at) => {
      const r = find(id);
      if (r) Object.assign(r, { sent_at: at, message: '', screenshot: null });
    },
    markRefused: async (id, at) => {
      const r = find(id);
      if (r) r.refused_at = at;
    },
    markPictureUp: async (id, path) => {
      const r = find(id);
      if (r) r.picture_path = path;
    },
    all: () => table.map((r) => ({ ...r })),
  };
}
