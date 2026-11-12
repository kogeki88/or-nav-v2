// The feedback port: the admins' floating button sends a short report (spec #18).
// Each report is saved on the phone first, then sent (ticket #20: the outbox). See src/core/feedback/.

export type FeedbackTag = 'broken' | 'looks_wrong' | 'idea';

/** What the form gives. The page, time, app version and id are added by the sender. */
export type FeedbackDraft = {
  tag: FeedbackTag;
  message: string;
  page: string;
  /** The picture of the page, taken before the form opened with the button hidden (a local file uri). Ticket #23. */
  screenshot?: string | null;
};

export type FeedbackResult =
  | { kind: 'sent' }
  /** Saved on the phone; it sends on its own when the signal comes back. */
  | { kind: 'saved' }
  /** In words an admin can read. The message text is never logged. */
  | { kind: 'error'; message: string };

export interface FeedbackSender {
  /** Saves the report on the phone, then tries to send every waiting report. */
  submit(draft: FeedbackDraft): Promise<FeedbackResult>;
  /** Tries to send every waiting report (app start, return to the app). Never throws. */
  flush(): Promise<void>;
  /** Stops the timed retries (sign-out or a new user). Reports stay saved on the phone. */
  close(): void;
}
