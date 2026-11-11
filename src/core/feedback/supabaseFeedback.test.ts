import { describe, expect, it } from '@jest/globals';

import { supabaseFeedback } from './supabaseFeedback';

const NOW = new Date('2026-11-11T14:05:00.000Z');

function fakeClient(answer: { error: { message: string } | null } | Error) {
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

function sender(answer: Parameters<typeof fakeClient>[0]) {
  const { client, sent } = fakeClient(answer);
  const faults: unknown[] = [];
  const s = supabaseFeedback(client, { appVersion: () => '2.6.0', now: () => NOW, onFault: (e) => faults.push(e) });
  return { s, sent, faults };
}

describe('supabaseFeedback', () => {
  it('sends one row with the page, tag, message, time and app version', async () => {
    const { s, sent } = sender({ error: null });
    const result = await s.submit({ tag: 'looks_wrong', message: '  Button too small  ', page: 'library / library sheet' });
    expect(result).toEqual({ kind: 'sent' });
    expect(sent).toHaveLength(1);
    expect(sent[0].table).toBe('feedback_reports');
    expect(sent[0].row).toMatchObject({
      tag: 'looks_wrong',
      message: 'Button too small',
      page: 'library / library sheet',
      created_at: '2026-11-11T14:05:00.000Z',
      app_version: '2.6.0',
    });
    expect(sent[0].row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('gives each report its own id', async () => {
    const { s, sent } = sender({ error: null });
    await s.submit({ tag: 'idea', message: 'a', page: 'main' });
    await s.submit({ tag: 'idea', message: 'a', page: 'main' });
    expect(sent[0].row.id).not.toBe(sent[1].row.id);
  });

  it('refuses an empty message without sending', async () => {
    const { s, sent } = sender({ error: null });
    const result = await s.submit({ tag: 'broken', message: '   ', page: 'main' });
    expect(result.kind).toBe('error');
    expect(sent).toHaveLength(0);
  });

  it('shows a refused send plainly and logs the error only, never the message text', async () => {
    const { s, faults } = sender({ error: { message: 'new row violates row-level security policy' } });
    const result = await s.submit({ tag: 'broken', message: 'secret words', page: 'main' });
    expect(result).toEqual({ kind: 'error', message: 'Not sent: new row violates row-level security policy' });
    expect(faults).toHaveLength(1);
    expect(String(faults[0])).not.toContain('secret words');
  });

  it('shows no connection when the network call throws', async () => {
    const { s, faults } = sender(new TypeError('Network request failed'));
    const result = await s.submit({ tag: 'idea', message: 'hello', page: 'main' });
    expect(result).toEqual({ kind: 'error', message: 'Not sent: no connection. Try again when online.' });
    expect(faults).toHaveLength(1);
  });
});
