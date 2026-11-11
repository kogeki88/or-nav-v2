// The feedback port, sent straight to the Supabase table `feedback_reports` (online only, no screenshot).
// The phone makes a new id on each submit (each tap of Send). Never logs the message text.
import type { FeedbackSender } from '../../contracts/feedback';

/** Only the part of the Supabase client this sender uses (a fake one in tests). */
export type FeedbackClient = {
  from(table: string): { insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }> };
};

export type FeedbackDeps = {
  appVersion: () => string;
  /** Pass logFault: it gets the error only. */
  onFault: (e: unknown) => void;
  now?: () => Date;
};

/** A random version-4 uuid (the table's primary key). */
export function newReportId(random: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16));
  hex[12] = 4;
  hex[16] = 8 + (hex[16] % 4);
  const s = hex.map((n) => n.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function supabaseFeedback(client: FeedbackClient, deps: FeedbackDeps): FeedbackSender {
  const now = deps.now ?? (() => new Date());
  return {
    async submit(draft) {
      const message = draft.message.trim();
      if (message === '') return { kind: 'error', message: 'Type a message first.' };
      const row = {
        id: newReportId(),
        created_at: now().toISOString(),
        app_version: deps.appVersion(),
        page: draft.page,
        tag: draft.tag,
        message,
      };
      try {
        const { error } = await client.from('feedback_reports').insert(row);
        if (error) {
          deps.onFault(new Error(`feedback insert: ${error.message}`));
          return { kind: 'error', message: `Not sent: ${error.message}` };
        }
        return { kind: 'sent' };
      } catch (e) {
        deps.onFault(e);
        return { kind: 'error', message: 'Not sent: no connection. Try again when online.' };
      }
    },
  };
}
