// The outbox's uploader: one report → one row in the Supabase table `feedback_reports` (no screenshot yet).
// The row's id is made on the phone, so a duplicate-key answer means an earlier try already arrived.
import type { FeedbackRow, Uploader } from './outbox';

/** Only the part of the Supabase client this uploader uses (a fake one in tests). */
export type FeedbackClient = {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string; code?: string } | null }>;
  };
};

/** Postgres "unique_violation": the server already has this id. */
const DUPLICATE_KEY = '23505';

/**
 * Postgres codes that mean "this row will never be taken": bad data (class 22), a broken check or
 * missing value (class 23), or no permission (42501, for example the admin role was removed).
 * Anything else (no signal, expired sign-in, server busy) is tried again later.
 */
function refusedForGood(code: string | undefined): boolean {
  return code !== undefined && (code.startsWith('22') || code.startsWith('23') || code === '42501');
}

export function supabaseUploader(client: FeedbackClient): Uploader {
  return async (row: FeedbackRow) => {
    try {
      const { error } = await client.from('feedback_reports').insert({ ...row });
      if (!error || error.code === DUPLICATE_KEY) return { ok: true };
      return { ok: false, error: new Error(`feedback insert: ${error.message}`), retry: !refusedForGood(error.code) };
    } catch (e) {
      return { ok: false, error: e, retry: true };
    }
  };
}
