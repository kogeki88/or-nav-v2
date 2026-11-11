import { describe, expect, it, jest } from '@jest/globals';
import { makeUuid } from './uuid';

const mockLogFault = jest.fn();
jest.mock('../../diag/faultStore', () => ({ logFault: (...args: unknown[]) => mockLogFault(...args) }));

// Imported after the mock so the adapter sees the fake logFault.
const { supabaseFeedback } = require('./supabaseFeedback') as typeof import('./supabaseFeedback');

const draft = { id: 'report-1', tag: 'idea' as const, message: '  Make the button bigger  ', page: 'Main screen', appVersion: '2.6.0' };

function fakeClient(result: () => Promise<unknown>) {
  const inserted: unknown[] = [];
  const client = {
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserted.push({ table, row });
        return result();
      },
    }),
  };
  return { client: client as never, inserted };
}

describe('makeUuid', () => {
  it('makes a version 4 UUID in the standard shape', () => {
    const id = makeUuid(() => 0.5);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('supabaseFeedback', () => {
  it('inserts one row with the page, tag, trimmed message and app version', async () => {
    const { client, inserted } = fakeClient(async () => ({ error: null }));
    await supabaseFeedback(client).send(draft);
    expect(inserted).toHaveLength(1);
    const { table, row } = inserted[0] as { table: string; row: Record<string, unknown> };
    expect(table).toBe('feedback_reports');
    expect(row).toMatchObject({ page: 'Main screen', tag: 'idea', message: 'Make the button bigger', app_version: '2.6.0' });
    expect(typeof row.id).toBe('string');
    expect(row.user_id).toBeUndefined(); // the table fills it from the signed-in user
  });

  it('gives a plain message and logs only the code and message, never the details', async () => {
    const error = { code: '42501', message: 'new row violates row-level security policy', details: 'Failing row contains (secret text)' };
    const { client } = fakeClient(async () => ({ error }));
    await expect(supabaseFeedback(client).send(draft)).rejects.toThrow('could not be sent');
    const logged = mockLogFault.mock.calls.at(-1)?.[1] as Error;
    expect(logged.message).toBe('42501 new row violates row-level security policy');
    expect(logged.message).not.toContain('secret');
  });

  it('counts a retry of an id already saved as sent', async () => {
    const { client } = fakeClient(async () => ({ error: { code: '23505', message: 'duplicate key value' } }));
    await expect(supabaseFeedback(client).send(draft)).resolves.toBeUndefined();
  });

  it('uses the id from the draft, so a retry sends the same id', async () => {
    const { client, inserted } = fakeClient(async () => ({ error: null }));
    await supabaseFeedback(client).send({ ...draft, id: 'fixed-id' });
    expect((inserted[0] as { row: { id: string } }).row.id).toBe('fixed-id');
  });

  it('asks for the migration when the table is missing', async () => {
    const { client } = fakeClient(async () => ({ error: { message: 'relation "public.feedback_reports" does not exist' } }));
    await expect(supabaseFeedback(client).send(draft)).rejects.toThrow('0005_feedback_reports.sql');
  });

  it('logs and reports a network failure without the message text', async () => {
    const { client } = fakeClient(async () => {
      throw new Error('Network request failed');
    });
    await expect(supabaseFeedback(client).send(draft)).rejects.toThrow('could not be sent');
    expect(mockLogFault).toHaveBeenLastCalledWith('feedback', expect.any(Error));
  });
});
