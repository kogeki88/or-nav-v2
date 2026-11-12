import { describe, expect, it } from '@jest/globals';

import type { FeedbackRow } from './outbox';
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
    expect(sent).toEqual([{ table: 'feedback_reports', row: ROW }]);
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
