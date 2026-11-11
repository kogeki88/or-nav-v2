// The feedback port: the admins' floating button sends a short report (spec #18).
// This first slice sends online only and has no screenshot. See src/core/feedback/.

export type FeedbackTag = 'broken' | 'looks_wrong' | 'idea';

/** What the form gives. The page, time, app version and id are added by the sender. */
export type FeedbackDraft = { tag: FeedbackTag; message: string; page: string };

export type FeedbackResult =
  | { kind: 'sent' }
  /** In words an admin can read. The message text is never logged. */
  | { kind: 'error'; message: string };

export interface FeedbackSender {
  submit(draft: FeedbackDraft): Promise<FeedbackResult>;
}
