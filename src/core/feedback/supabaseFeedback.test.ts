import { describe, expect, it } from '@jest/globals';

import { type FeedbackRow, makeFeedbackOutbox, memoryOutboxRows } from './outbox';
import { supabaseUploader } from './supabaseFeedback';

const ROW: FeedbackRow = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  created_at: '2026-11-11T14:05:00.000Z',
  app_version: '2.6.0',
  page: 'library / library sheet',
  tag: 'looks_wrong',
  message: 'Button too small',
};

type Answer = { error: { message: string; code?: string } | null } | Error;

function fakeClient(answer: Answer) {
  const sent: { table: string; row: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          if (answer instanceof Error) throw answer;
          sent.push({ table, row });
          return answer;
        },
      };
    },
  };
  return { client, sent };
}

describe('supabaseUploader', () => {
  it('inserts the report as one row in feedback_reports', async () => {
    const { client, sent } = fakeClient({ error: null });
    expect(await supabaseUploader(client)(ROW)).toEqual({ ok: true });
    expect(sent).toEqual([{ table: 'feedback_reports', row: { ...ROW, screenshot_path: null } }]);
  });

  it('counts a duplicate id as sent (an earlier try arrived), so no second row is made', async () => {
    const { client } = fakeClient({ error: { message: 'duplicate key value violates unique constraint', code: '23505' } });
    expect(await supabaseUploader(client)(ROW)).toEqual({ ok: true });
  });

  it('gives back a refused insert as a final error (no retry) without the message text', async () => {
    const { client } = fakeClient({ error: { message: 'new row violates row-level security policy', code: '42501' } });
    const result = await supabaseUploader(client)(ROW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retry).toBe(false);
      expect(String(result.error)).toContain('row-level security');
      expect(String(result.error)).not.toContain('Button too small');
    }
  });

  it('tries again later after an expired sign-in or a server hiccup', async () => {
    const { client } = fakeClient({ error: { message: 'JWT expired', code: 'PGRST301' } });
    const result = await supabaseUploader(client)(ROW);
    expect(result.ok === false && result.retry).toBe(true);
  });

  it('gives back a network failure as an error to try again', async () => {
    const { client } = fakeClient(new TypeError('Network request failed'));
    const result = await supabaseUploader(client)(ROW);
    expect(result).toEqual({ ok: false, error: new TypeError('Network request failed'), retry: true });
  });
});

const USER = 'a1b2c3d4-0000-4000-8000-000000000001';
const PICTURE = 'file:///data/user/0/com.ornav.app/files/feedback/x.jpg';

/**
 * A fake Supabase: a table keyed by id (a second insert of an id answers 23505) and a bucket
 * keyed by path (upsert overwrites). `rowFails` / `pictureFails` make the next calls fail like no signal.
 */
function fakeSupabase() {
  const table = new Map<string, Record<string, unknown>>();
  const bucket = new Map<string, { bytes: ArrayBuffer; contentType: string; upsert: boolean }>();
  const state = { rowFails: 0, pictureFails: 0, pictureAnswer: null as { message: string; status?: number; statusCode?: string } | null };
  const client = {
    from(_table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          if (state.rowFails > 0) {
            state.rowFails--;
            throw new TypeError('Network request failed');
          }
          if (table.has(String(row.id))) return { error: { message: 'duplicate key', code: '23505' } };
          table.set(String(row.id), row);
          return { error: null };
        },
      };
    },
  };
  const store = {
    upload: async (path: string, bytes: ArrayBuffer, options: { contentType: string; upsert: boolean }) => {
      if (state.pictureFails > 0) {
        state.pictureFails--;
        throw new TypeError('Network request failed');
      }
      if (state.pictureAnswer) return { error: state.pictureAnswer };
      if (bucket.has(path) && !options.upsert) return { error: { message: 'The resource already exists', status: 409 } };
      bucket.set(path, { bytes, ...options });
      return { error: null };
    },
  };
  const files = new Map<string, ArrayBuffer>([[PICTURE, new ArrayBuffer(8)]]);
  const pictures = { userId: USER, bucket: store, read: async (uri: string) => files.get(uri) ?? null };
  return { client, pictures, table, bucket, files, state };
}

describe('supabaseUploader with a screenshot (ticket #23)', () => {
  const WITH_PICTURE: FeedbackRow = { ...ROW, screenshot: PICTURE };

  it('uploads the picture to <user id>/<report id>.jpg first, then the row with its screenshot_path', async () => {
    const s = fakeSupabase();
    expect(await supabaseUploader(s.client, s.pictures)(WITH_PICTURE)).toEqual({ ok: true });
    const path = `${USER}/${ROW.id}.jpg`;
    expect([...s.bucket.keys()]).toEqual([path]);
    expect(s.bucket.get(path)).toMatchObject({ contentType: 'image/jpeg', upsert: true });
    expect(s.table.get(ROW.id)).toEqual({ ...ROW, screenshot_path: path });
    expect(s.table.get(ROW.id)).not.toHaveProperty('screenshot');
  });

  it('sends no row while the picture cannot go up, and tries again later', async () => {
    const s = fakeSupabase();
    s.state.pictureFails = 1;
    const result = await supabaseUploader(s.client, s.pictures)(WITH_PICTURE);
    expect(result.ok === false && result.retry).toBe(true);
    expect(s.table.size).toBe(0);
  });

  it('sends the row without a picture when the bucket refuses the picture for good (HTTP 400, statusCode "403")', async () => {
    const s = fakeSupabase();
    s.state.pictureAnswer = { message: 'new row violates row-level security policy', status: 400, statusCode: '403' };
    expect(await supabaseUploader(s.client, s.pictures)(WITH_PICTURE)).toEqual({ ok: true });
    expect(s.table.get(ROW.id)).toMatchObject({ screenshot_path: null });
  });

  it('sends the row without a picture when the picture is too big (413)', async () => {
    const s = fakeSupabase();
    s.state.pictureAnswer = { message: 'Payload too large', status: 413 };
    expect(await supabaseUploader(s.client, s.pictures)(WITH_PICTURE)).toEqual({ ok: true });
    expect(s.table.get(ROW.id)).toMatchObject({ screenshot_path: null });
  });

  it('tries again later when the bucket has a hiccup (500)', async () => {
    const s = fakeSupabase();
    s.state.pictureAnswer = { message: 'Internal error', status: 500 };
    const result = await supabaseUploader(s.client, s.pictures)(WITH_PICTURE);
    expect(result.ok === false && result.retry).toBe(true);
    expect(s.table.size).toBe(0);
  });

  it('sends the row without a picture when the phone lost the picture file', async () => {
    const s = fakeSupabase();
    s.files.clear();
    expect(await supabaseUploader(s.client, s.pictures)(WITH_PICTURE)).toEqual({ ok: true });
    expect(s.bucket.size).toBe(0);
    expect(s.table.get(ROW.id)).toMatchObject({ screenshot_path: null });
  });

  it('a partial upload (picture done, row failed) completes on the next flush with one row and one picture', async () => {
    const s = fakeSupabase();
    const rows = memoryOutboxRows();
    const outbox = makeFeedbackOutbox(rows, supabaseUploader(s.client, s.pictures), {
      appVersion: () => '2.6.0',
      role: () => 'admin',
      onFault: () => undefined,
    });
    s.state.rowFails = 1;
    expect(await outbox.submit({ tag: 'broken', message: 'Button too small', page: 'main', screenshot: PICTURE })).toEqual({ kind: 'saved' });
    expect(s.bucket.size).toBe(1);
    expect(s.table.size).toBe(0);

    await outbox.flush();
    expect(s.table.size).toBe(1);
    expect(s.bucket.size).toBe(1);
    const [id] = [...s.table.keys()];
    expect([...s.bucket.keys()]).toEqual([`${USER}/${id}.jpg`]);
    expect(s.table.get(id)).toMatchObject({ screenshot_path: `${USER}/${id}.jpg` });
    expect(await rows.waiting()).toHaveLength(0);

    await outbox.flush();
    expect(s.table.size).toBe(1);
    expect(s.bucket.size).toBe(1);
  });
});
