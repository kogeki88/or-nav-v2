import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { FeedbackRow, UploadResult, makeFeedbackOutbox, memoryOutboxRows } from './outbox';

const NOW = new Date('2026-11-12T10:00:00.000Z');

/** A fake server: one table keyed by id. `online` and `failNext` steer what it answers. */
function fakeServer() {
  const table = new Map<string, FeedbackRow>();
  const state = { online: true, calls: 0, lostAnswer: false };
  const upload = async (row: FeedbackRow): Promise<UploadResult> => {
    state.calls++;
    if (!state.online) return { ok: false, error: new TypeError('Network request failed'), retry: true };
    const isNew = !table.has(row.id);
    if (isNew) table.set(row.id, row);
    if (state.lostAnswer) {
      // The row arrived, but the phone never heard back.
      state.lostAnswer = false;
      return { ok: false, error: new TypeError('Network request failed'), retry: true };
    }
    return { ok: true };
  };
  return { table, state, upload };
}

function setup(role: string | null = 'admin') {
  const server = fakeServer();
  const rows = memoryOutboxRows();
  const faults: unknown[] = [];
  const outbox = makeFeedbackOutbox(rows, server.upload, {
    appVersion: () => '2.6.0',
    role: () => role,
    now: () => NOW,
    onFault: (e) => faults.push(e),
  });
  return { outbox, rows, server, faults };
}

const DRAFT = { tag: 'broken' as const, message: '  Button too small  ', page: 'main / case panel' };

describe('feedback outbox', () => {
  it('sends a report at once when online and marks it sent', async () => {
    const { outbox, rows, server } = setup();
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'sent' });
    expect(server.table.size).toBe(1);
    const [row] = [...server.table.values()];
    expect(row).toMatchObject({ tag: 'broken', message: 'Button too small', page: 'main / case panel', created_at: NOW.toISOString(), app_version: '2.6.0' });
    expect(await rows.waiting()).toHaveLength(0);
  });

  it('saves an offline submit on the phone and reports it as saved', async () => {
    const { outbox, rows, server } = setup();
    server.state.online = false;
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'saved' });
    expect(server.table.size).toBe(0);
    expect(await rows.waiting()).toHaveLength(1);
  });

  it('sends a waiting report on a later flush and marks it sent', async () => {
    const { outbox, rows, server } = setup();
    server.state.online = false;
    await outbox.submit(DRAFT);
    server.state.online = true;
    await outbox.flush();
    expect(server.table.size).toBe(1);
    expect(await rows.waiting()).toHaveLength(0);
  });

  it('keeps a failed upload waiting and sends it on the next flush', async () => {
    const { outbox, rows, server } = setup();
    server.state.online = false;
    await outbox.submit(DRAFT);
    await outbox.flush();
    expect(await rows.waiting()).toHaveLength(1);
    server.state.online = true;
    await outbox.flush();
    expect(server.table.size).toBe(1);
    expect(await rows.waiting()).toHaveLength(0);
  });

  it('sends older waiting reports after a new submit', async () => {
    const { outbox, server } = setup();
    server.state.online = false;
    await outbox.submit(DRAFT);
    server.state.online = true;
    expect(await outbox.submit({ ...DRAFT, message: 'second' })).toEqual({ kind: 'sent' });
    expect(server.table.size).toBe(2);
  });

  it('never uploads a sent report again', async () => {
    const { outbox, server } = setup();
    await outbox.submit(DRAFT);
    const calls = server.state.calls;
    await outbox.flush();
    await outbox.flush();
    expect(server.state.calls).toBe(calls);
  });

  it('makes no duplicate row when a retry follows an unknown result', async () => {
    const { outbox, rows, server } = setup();
    server.state.lostAnswer = true;
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'saved' });
    await outbox.flush();
    expect(server.table.size).toBe(1);
    expect(await rows.waiting()).toHaveLength(0);
  });

  it('runs two flushes at the same time one after the other, so nothing is sent twice', async () => {
    const { outbox, server } = setup();
    server.state.online = false;
    await outbox.submit(DRAFT);
    server.state.online = true;
    const before = server.state.calls;
    await Promise.all([outbox.flush(), outbox.flush()]);
    expect(server.state.calls - before).toBe(1);
  });

  it('refuses a non-admin and saves nothing', async () => {
    const { outbox, rows, server } = setup('nurse');
    const result = await outbox.submit(DRAFT);
    expect(result.kind).toBe('error');
    expect(await rows.waiting()).toHaveLength(0);
    expect(server.state.calls).toBe(0);
  });

  it('refuses an empty message and saves nothing', async () => {
    const { outbox, rows } = setup();
    expect((await outbox.submit({ ...DRAFT, message: '   ' })).kind).toBe('error');
    expect(await rows.waiting()).toHaveLength(0);
  });

  it('logs a failed upload with the error only, never the message text', async () => {
    const { outbox, server, faults } = setup();
    server.state.online = false;
    await outbox.submit({ ...DRAFT, message: 'secret words' });
    expect(faults).toHaveLength(1);
    expect(faults[0]).toBeInstanceOf(TypeError);
    expect(String(faults[0])).not.toContain('secret words');
  });

  it('refuses a message longer than the server takes (4000 characters) and saves nothing', async () => {
    const { outbox, rows } = setup();
    expect((await outbox.submit({ ...DRAFT, message: 'x'.repeat(4001) })).kind).toBe('error');
    expect(await rows.waiting()).toHaveLength(0);
  });

  it('shows a server refusal plainly, stops trying that report, and still sends the ones after it', async () => {
    const { outbox, rows, server } = setup();
    server.state.online = false;
    await outbox.submit({ ...DRAFT, message: 'first' });
    server.state.online = true;
    const upload = server.upload;
    let refuse = true;
    const refusing = makeFeedbackOutbox(rows, async (row) => {
      if (refuse && row.message === 'first') return { ok: false, error: new Error('feedback insert: check violation'), retry: false };
      return upload(row);
    }, { appVersion: () => '2.6.0', role: () => 'admin', onFault: () => undefined });
    expect(await refusing.submit({ ...DRAFT, message: 'second' })).toEqual({ kind: 'sent' });
    expect([...server.table.values()].map((r) => r.message)).toEqual(['second']);
    expect(await rows.waiting()).toHaveLength(0);
    refuse = false;
    await refusing.flush();
    expect(server.table.size).toBe(1);
    void outbox;
  });

  it('answers with the server reason when its own report is refused', async () => {
    const rows = memoryOutboxRows();
    const outbox = makeFeedbackOutbox(rows, async () => ({ ok: false, error: new Error('feedback insert: row-level security'), retry: false }), {
      appVersion: () => '2.6.0',
      role: () => 'admin',
      onFault: () => undefined,
    });
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'error', message: 'Not sent: feedback insert: row-level security' });
  });

  it('answers sent when the upload worked but marking it sent on the phone failed', async () => {
    const { outbox, rows, server, faults } = setup();
    rows.markSent = async () => {
      throw new Error('database locked');
    };
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'sent' });
    expect(server.table.size).toBe(1);
    expect(faults).toHaveLength(1);
  });

  it('answers saved when sending takes too long, while the report stays safe on the phone', async () => {
    const rows = memoryOutboxRows();
    const outbox = makeFeedbackOutbox(rows, () => new Promise<never>(() => undefined), {
      appVersion: () => '2.6.0',
      role: () => 'admin',
      onFault: () => undefined,
      waitMs: 10,
    });
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'saved' });
    expect(await rows.waiting()).toHaveLength(1);
  });

  it('shows an error and logs it when the phone cannot save the report', async () => {
    const { outbox, rows, server, faults } = setup();
    rows.add = async () => {
      throw new Error('disk full');
    };
    const result = await outbox.submit(DRAFT);
    expect(result.kind).toBe('error');
    expect(server.state.calls).toBe(0);
    expect(faults).toHaveLength(1);
  });
});

describe('feedback outbox: the phone keeps no message text of a sent report (ticket #28)', () => {
  it('clears the message text once the report is sent, and sets sent_at', async () => {
    const { outbox, rows } = setup();
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'sent' });
    const [row] = rows.all();
    expect(row.message).toBe('');
    expect(row.sent_at).toBe(NOW.toISOString());
  });

  it('keeps the text of a report that waits after a failed upload', async () => {
    const { outbox, rows, server } = setup();
    server.state.online = false;
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'saved' });
    await outbox.flush();
    const [row] = rows.all();
    expect(row.message).toBe('Button too small');
    expect(row.sent_at).toBeNull();
  });

  it('keeps the text of a report the server refused', async () => {
    const rows = memoryOutboxRows();
    const outbox = makeFeedbackOutbox(rows, async () => ({ ok: false, error: new Error('refused'), retry: false }), {
      appVersion: () => '2.6.0',
      role: () => 'admin',
      onFault: () => undefined,
    });
    await outbox.submit(DRAFT);
    expect(rows.all()[0].message).toBe('Button too small');
  });

  it('a retry after an unknown result makes no duplicate row and then clears the text', async () => {
    const { outbox, rows, server } = setup();
    server.state.lostAnswer = true;
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'saved' });
    expect(rows.all()[0].message).toBe('Button too small');
    await outbox.flush();
    expect(server.table.size).toBe(1);
    expect(rows.all()).toHaveLength(1);
    expect(rows.all()[0]).toMatchObject({ message: '', sent_at: NOW.toISOString() });
  });
});

describe('feedback outbox: sends again when the signal comes back (ticket #27)', () => {
  const RETRY_MS = 15000;

  function retrySetup() {
    const server = fakeServer();
    const rows = memoryOutboxRows();
    const outbox = makeFeedbackOutbox(rows, server.upload, {
      appVersion: () => '2.6.0',
      role: () => 'admin',
      now: () => NOW,
      onFault: () => undefined,
      retryMs: RETRY_MS,
    });
    return { outbox, rows, server };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends a waiting report once the network is back, with no app restart', async () => {
    const { outbox, rows, server } = retrySetup();
    server.state.online = false;
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'saved' });
    server.state.online = true;
    const before = server.state.calls;
    await jest.advanceTimersByTimeAsync(RETRY_MS);
    expect(server.state.calls - before).toBe(1);
    expect(server.table.size).toBe(1);
    expect(await rows.waiting()).toHaveLength(0);
    outbox.close();
  });

  it('keeps trying while offline and stops trying once nothing waits', async () => {
    const { outbox, server } = retrySetup();
    server.state.online = false;
    await outbox.submit(DRAFT);
    await jest.advanceTimersByTimeAsync(RETRY_MS * 2);
    expect(server.table.size).toBe(0);
    server.state.online = true;
    await jest.advanceTimersByTimeAsync(RETRY_MS);
    const calls = server.state.calls;
    await jest.advanceTimersByTimeAsync(RETRY_MS * 4);
    expect(server.state.calls).toBe(calls);
    expect(jest.getTimerCount()).toBe(0);
    outbox.close();
  });

  it('two quick online events (a retry and a return to the app) upload the report once', async () => {
    const { outbox, server } = retrySetup();
    server.state.online = false;
    await outbox.submit(DRAFT);
    server.state.online = true;
    const before = server.state.calls;
    await Promise.all([jest.advanceTimersByTimeAsync(RETRY_MS), outbox.flush(), outbox.flush()]);
    expect(server.state.calls - before).toBe(1);
    expect(server.table.size).toBe(1);
    outbox.close();
  });

  it('logs no-signal once, not on every timed retry, so the fault log keeps its other entries', async () => {
    const server = fakeServer();
    const faults: unknown[] = [];
    const outbox = makeFeedbackOutbox(memoryOutboxRows(), server.upload, {
      appVersion: () => '2.6.0',
      role: () => 'admin',
      onFault: (e) => faults.push(e),
      retryMs: RETRY_MS,
    });
    server.state.online = false;
    await outbox.submit(DRAFT);
    await jest.advanceTimersByTimeAsync(RETRY_MS * 5);
    expect(server.state.calls).toBe(6);
    expect(faults).toHaveLength(1);
    outbox.close();
  });

  it('stops trying after close, so a signed-out user\'s outbox never sends', async () => {
    const { outbox, server } = retrySetup();
    server.state.online = false;
    await outbox.submit(DRAFT);
    outbox.close();
    server.state.online = true;
    const before = server.state.calls;
    await jest.advanceTimersByTimeAsync(RETRY_MS * 3);
    expect(server.state.calls).toBe(before);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('feedback outbox: the screenshot (ticket #23)', () => {
  const TMP = 'file:///cache/ReactNative-snapshot-1.jpg';

  function pictureSetup() {
    const server = fakeServer();
    const rows = memoryOutboxRows();
    const kept: { from: string; id: string }[] = [];
    const dropped: string[] = [];
    const faults: unknown[] = [];
    const deps = {
      appVersion: () => '2.6.0',
      role: () => 'admin',
      now: () => NOW,
      onFault: (e: unknown) => faults.push(e),
      keepScreenshot: async (from: string, id: string) => {
        kept.push({ from, id });
        return `file:///files/feedback/${id}.jpg`;
      },
      dropScreenshot: async (uri: string) => {
        dropped.push(uri);
      },
    };
    return { server, rows, kept, dropped, faults, deps, outbox: makeFeedbackOutbox(rows, server.upload, deps) };
  }

  it('keeps the picture on the phone under the report id and saves it with the waiting report', async () => {
    const { outbox, rows, server, kept } = pictureSetup();
    server.state.online = false;
    expect(await outbox.submit({ ...DRAFT, screenshot: TMP })).toEqual({ kind: 'saved' });
    const [row] = await rows.waiting();
    expect(kept).toEqual([{ from: TMP, id: row.id }]);
    expect(row.screenshot).toBe(`file:///files/feedback/${row.id}.jpg`);
  });

  it('uploads the kept picture with the report', async () => {
    const { outbox, server } = pictureSetup();
    await outbox.submit({ ...DRAFT, screenshot: TMP });
    const [row] = [...server.table.values()];
    expect(row.screenshot).toBe(`file:///files/feedback/${row.id}.jpg`);
  });

  it('removes the phone copy of the picture once the report is sent (like ticket #28)', async () => {
    const { outbox, rows, dropped } = pictureSetup();
    expect(await outbox.submit({ ...DRAFT, screenshot: TMP })).toEqual({ kind: 'sent' });
    const [row] = rows.all();
    expect(dropped).toEqual([`file:///files/feedback/${row.id}.jpg`]);
    expect(row.screenshot).toBeNull();
  });

  it('removes the phone copy of a refused report\'s picture, which can never be sent', async () => {
    const { rows, deps, dropped } = pictureSetup();
    const outbox = makeFeedbackOutbox(rows, async () => ({ ok: false, error: new Error('refused'), retry: false }), deps);
    await outbox.submit({ ...DRAFT, screenshot: TMP });
    const [row] = rows.all();
    expect(dropped).toEqual([`file:///files/feedback/${row.id}.jpg`]);
  });

  it('keeps the phone copy while the report waits', async () => {
    const { outbox, server, dropped } = pictureSetup();
    server.state.online = false;
    await outbox.submit({ ...DRAFT, screenshot: TMP });
    await outbox.flush();
    expect(dropped).toEqual([]);
  });

  it('still saves the report, without a picture, when the phone cannot keep the picture', async () => {
    const { rows, server, faults, deps } = pictureSetup();
    const outbox = makeFeedbackOutbox(rows, server.upload, {
      ...deps,
      keepScreenshot: async () => {
        throw new Error('disk full');
      },
    });
    server.state.online = false;
    expect(await outbox.submit({ ...DRAFT, screenshot: TMP })).toEqual({ kind: 'saved' });
    expect((await rows.waiting())[0].screenshot).toBeNull();
    expect(faults).toEqual([new Error('disk full'), expect.anything()]);
  });

  it('sends a report with no picture as before', async () => {
    const { outbox, server, kept } = pictureSetup();
    expect(await outbox.submit(DRAFT)).toEqual({ kind: 'sent' });
    expect(kept).toEqual([]);
    expect([...server.table.values()][0].screenshot).toBeNull();
  });
});
