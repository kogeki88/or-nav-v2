// The feedback port: how an admin's report reaches the server. Types only (see README.md in this folder).
// Sending is online only in ticket #19; the offline outbox (ticket #20) keeps the same port.

/** The three tags a tester can pick. */
export type FeedbackTag = 'broken' | 'looks_wrong' | 'idea';

/** What the form gives the port. The id is made once per form, so a retry never saves a second copy. */
export type FeedbackDraft = {
  id: string;
  tag: FeedbackTag;
  message: string;
  /** Where the tester was, such as "Main screen + case panel". */
  page: string;
  appVersion: string;
};

export type FeedbackPort = {
  /** A new unique id for one report (the adapter makes it). */
  newId(): string;
  /** Resolves when the server has the report. Rejects with a plain message the tester can read. */
  send(draft: FeedbackDraft): Promise<void>;
};
