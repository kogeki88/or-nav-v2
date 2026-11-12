import { describe, expect, it, jest } from '@jest/globals';

// A fake phone database that records each statement, so the test sees the SQL the outbox runs.
// Jest lets a mock factory use only names that start with "mock".
const mockRuns: { sql: string; args: unknown[] }[] = [];
const mockDb = {
  runAsync: async (sql: string, ...args: unknown[]) => {
    mockRuns.push({ sql, args });
  },
  getAllAsync: async (_sql: string): Promise<unknown[]> => [],
};
jest.mock('../../db/libraryStore', () => ({
  serial: (job: (db: typeof mockDb) => Promise<unknown>) => job(mockDb),
}));

import { MIGRATIONS } from '../../db/schema';
import { sqliteOutboxRows } from './sqliteOutbox';

describe('sqlite feedback outbox (ticket #28)', () => {
  it('clears the message text in the same statement that sets sent_at', async () => {
    mockRuns.length = 0;
    await sqliteOutboxRows('user-1').markSent('id-1', '2026-11-12T10:00:00.000Z');
    expect(mockRuns).toHaveLength(1);
    expect(mockRuns[0].sql).toBe("UPDATE feedback_outbox SET sent_at = ?, message = '', screenshot = NULL WHERE id = ? AND user_id = ?");
    expect(mockRuns[0].args).toEqual(['2026-11-12T10:00:00.000Z', 'id-1', 'user-1']);
  });

  it('saves the screenshot uri with the waiting report (ticket #23)', async () => {
    mockRuns.length = 0;
    await sqliteOutboxRows('user-1').add({
      id: 'id-1',
      created_at: '2026-11-12T10:00:00.000Z',
      app_version: '2.6.0',
      page: 'main',
      tag: 'broken',
      message: 'Button too small',
      screenshot: 'file:///files/feedback/id-1.jpg',
    });
    expect(mockRuns[0].sql).toContain('screenshot');
    expect(mockRuns[0].args).toContain('file:///files/feedback/id-1.jpg');
  });

  it('notes that the picture is up, and reads it back with the waiting reports (ticket #32)', async () => {
    mockRuns.length = 0;
    await sqliteOutboxRows('user-1').markPictureUp('id-1', 'user-1/id-1.jpg');
    expect(mockRuns).toEqual([{ sql: 'UPDATE feedback_outbox SET picture_path = ? WHERE id = ? AND user_id = ?', args: ['user-1/id-1.jpg', 'id-1', 'user-1'] }]);
    let read = '';
    const before = mockDb.getAllAsync;
    mockDb.getAllAsync = async (sql: string) => {
      read = sql;
      return [];
    };
    try {
      await sqliteOutboxRows('user-1').waiting();
    } finally {
      mockDb.getAllAsync = before;
    }
    expect(read).toContain('picture_path');
  });

  it('adds the picture_path column in a new migration (ticket #32)', () => {
    expect(MIGRATIONS.find((m) => m.version === 6)?.sql).toContain('ALTER TABLE feedback_outbox ADD COLUMN picture_path TEXT');
  });

  it('keeps the message text of a refused report', async () => {
    mockRuns.length = 0;
    await sqliteOutboxRows('user-1').markRefused('id-1', '2026-11-12T10:00:00.000Z');
    expect(mockRuns[0].sql).not.toContain('message');
  });
});
