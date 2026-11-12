// The outbox's uploader: one report → its screenshot in the private bucket `feedback-screenshots`
// (ticket #23), then one row in the Supabase table `feedback_reports` with that screenshot_path.
// The row's id is made on the phone, so a duplicate-key answer means an earlier try already arrived,
// and the picture path <user id>/<report id>.jpg is overwritten on a retry, never made twice.
import type { FeedbackRow, Uploader } from './outbox';

/** Only the part of the Supabase client this uploader uses (a fake one in tests). */
export type FeedbackClient = {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string; code?: string } | null }>;
  };
};

/** The bucket, as `supabase.storage.from('feedback-screenshots')` gives it (a fake one in tests). */
export type PictureBucket = {
  upload(
    path: string,
    body: ArrayBuffer,
    options: { contentType: string; upsert: boolean },
  ): PromiseLike<{ error: { message: string; status?: number; statusCode?: string } | null }>;
};

export type Pictures = {
  /** The signed-in admin: the bucket takes pictures only in this user's own folder (migration 0006). */
  userId: string;
  bucket: PictureBucket;
  /** The picture file's bytes, or null when the phone no longer has the file. */
  read(uri: string): Promise<ArrayBuffer | null>;
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

/**
 * The bucket's "never": no permission (403) or a picture too big (413). Supabase Storage answers a
 * policy refusal with HTTP 400 and statusCode "403", so both are checked. Anything else is tried again.
 */
function pictureRefusedForGood(error: { status?: number; statusCode?: string }): boolean {
  return [error.statusCode, String(error.status)].some((s) => s === '403' || s === '413');
}

export function picturePath(userId: string, reportId: string): string {
  return `${userId}/${reportId}.jpg`;
}

export function supabaseUploader(client: FeedbackClient, pictures?: Pictures): Uploader {
  return async (row: FeedbackRow) => {
    try {
      let screenshotPath: string | null = null;
      if (row.screenshot && pictures) {
        const bytes = await pictures.read(row.screenshot);
        // No file (the phone lost it) or a picture the bucket never takes: the report still goes, without a picture.
        if (bytes) {
          const path = picturePath(pictures.userId, row.id);
          const { error } = await pictures.bucket.upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
          if (!error) screenshotPath = path;
          else if (!pictureRefusedForGood(error)) return { ok: false, error: new Error(`feedback screenshot: ${error.message}`), retry: true };
        }
      }
      const { screenshot: _local, ...fields } = row;
      const { error } = await client.from('feedback_reports').insert({ ...fields, screenshot_path: screenshotPath });
      if (!error || error.code === DUPLICATE_KEY) return { ok: true };
      return { ok: false, error: new Error(`feedback insert: ${error.message}`), retry: !refusedForGood(error.code) };
    } catch (e) {
      return { ok: false, error: e, retry: true };
    }
  };
}
