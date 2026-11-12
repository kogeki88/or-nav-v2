// The feedback outbox's rows in the phone's own database (ornav.db, table `feedback_outbox`, migrations v4, v5 and v6),
// through serial(). Each account sends only its own waiting reports. Sent and refused reports stay, with sent_at or refused_at set;
// a sent report's message text is cleared.
import { serial } from '../../db/libraryStore';
import type { FeedbackRow, OutboxRows } from './outbox';

export function sqliteOutboxRows(userId: string): OutboxRows {
  return {
    add: (r) =>
      serial(async (db) => {
        await db.runAsync(
          'INSERT INTO feedback_outbox (id, user_id, created_at, app_version, page, tag, message, screenshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          r.id,
          userId,
          r.created_at,
          r.app_version,
          r.page,
          r.tag,
          r.message,
          r.screenshot ?? null,
        );
      }),
    waiting: () =>
      serial((db) =>
        db.getAllAsync<FeedbackRow>(
          'SELECT id, created_at, app_version, page, tag, message, screenshot, picture_path FROM feedback_outbox WHERE user_id = ? AND sent_at IS NULL AND refused_at IS NULL ORDER BY created_at',
          userId,
        ),
      ),
    markSent: (id, at) =>
      serial(async (db) => {
        // The row stays (so it is never sent twice), but its message text goes (ticket #28; Sean's yes, 2026-11-12),
        // and so does its screenshot uri: the outbox then removes the picture file (ticket #23).
        await db.runAsync("UPDATE feedback_outbox SET sent_at = ?, message = '', screenshot = NULL WHERE id = ? AND user_id = ?", at, id, userId);
      }),
    markRefused: (id, at) =>
      serial(async (db) => {
        await db.runAsync('UPDATE feedback_outbox SET refused_at = ? WHERE id = ? AND user_id = ?', at, id, userId);
      }),
    markPictureUp: (id, path) =>
      serial(async (db) => {
        // The picture is in the bucket: a retry sends only the row (ticket #32).
        await db.runAsync('UPDATE feedback_outbox SET picture_path = ? WHERE id = ? AND user_id = ?', path, id, userId);
      }),
  };
}
