// The feedback port, answered by the feedback_reports table (migration 0005). Online only for now.
// Privacy: a report holds only what the tester typed, plus the page, tag and app version. Never log the message text,
// and log only the server's error code and message (never its details, which can echo a row).
import type { SupabaseClient } from '@supabase/supabase-js';

import type { FeedbackDraft, FeedbackPort } from '../../contracts/feedback';
import { logFault } from '../../diag/faultStore';
import { makeUuid } from './uuid';

const SEND_FAILED = 'The report could not be sent. Check the signal and try again.';
const NOT_SET_UP = 'The server is not set up yet. Run 0005_feedback_reports.sql in Supabase.';
/** Postgres code for "this id is already saved": an earlier try got through, so the report counts as sent. */
const ALREADY_SAVED = '23505';
/** Longer than this, the send counts as failed (a weak hospital signal can hang). */
const SEND_TIMEOUT_MS = 15000;

export function supabaseFeedback(client: SupabaseClient): FeedbackPort {
  return {
    newId: () => globalThis.crypto?.randomUUID?.() ?? makeUuid(),
    async send(draft: FeedbackDraft): Promise<void> {
      const row = {
        id: draft.id,
        created_at: new Date().toISOString(),
        app_version: draft.appVersion,
        page: draft.page,
        tag: draft.tag,
        message: draft.message.trim(),
      };
      try {
        const result = await withTimeout(Promise.resolve(client.from('feedback_reports').insert(row)));
        if (!result.error) return;
        if (result.error.code === ALREADY_SAVED) return;
        logFault('feedback', new Error(`${result.error.code ?? ''} ${result.error.message}`.trim()));
        throw new Error(/relation .* does not exist|schema cache/i.test(result.error.message) ? NOT_SET_UP : SEND_FAILED);
      } catch (e) {
        if (e instanceof Error && (e.message === SEND_FAILED || e.message === NOT_SET_UP)) throw e;
        logFault('feedback', e);
        throw new Error(SEND_FAILED);
      }
    },
  };
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out: no answer in time')), SEND_TIMEOUT_MS);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}
