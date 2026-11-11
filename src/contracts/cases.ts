// The cases port: each conversation in the one box is a case, saved on the phone only (never synced).
// A case keeps only what went to the AI (already scrubbed) and what came back. See src/core/cases/.
import type { Card } from './library';

export type CaseDraftState = 'ready' | 'sending' | 'sent' | 'error';

export type CaseMessage = {
  /** Unique within its case. */
  id: number;
  role: 'user' | 'assistant';
  /** A user message holds the scrubbed text that was sent, never the raw text. */
  text: string;
  /** Under a user message: what the scrubber removed. Under an answer: an error note. */
  note?: string;
  tone?: 'warn' | 'danger';
  /** The AI's actions, checked against the library when they arrived. */
  actions?: unknown[];
  drafts?: Record<number, { state: CaseDraftState; error?: string }>;
  /** 'backup' when the free backup AI answered instead of Claude. */
  engine?: 'claude' | 'backup';
  /** Made on the phone (offline line, privacy block, no department): shown, never saved. */
  local?: boolean;
};

export type Case = {
  id: string;
  /** ISO times. */
  createdAt: string;
  lastUsedAt: string;
  surgeon: string | null;
  procedure: string | null;
  cardId: string | null;
  /** The nurse set the surgeon and procedure herself, so learning never changes them. */
  setByNurse: boolean;
  messages: CaseMessage[];
};

/** A case as one line in a list: the sidebar and "Pick up a case". `known`: the surgeon or procedure is set. */
export type CaseListRow = { id: string; label: string; when: string; current: boolean; known: boolean };

/**
 * How a case learns its surgeon, procedure and card, quietly: never a pop-up or a question.
 * Each call gives back the same case object when nothing changes. See src/core/cases/learn.ts.
 */
export interface CaseLearning {
  /** Opening a preference card sets the case to that card. */
  fromCard(c: Case, card: Card): Case;
  /** A sent message whose words name exactly one of these cards (surgeon and procedure) sets it. */
  fromText(c: Case, text: string, cards: Card[]): Case;
  /** The nurse picks a card herself (then learning never changes it), or null to clear the case. */
  byHand(c: Case, card: Card | null): Case;
}

/** The current case's conversation, as the one box sees it. `id` is null while the cases load. */
export type CaseThread = {
  id: string | null;
  messages: CaseMessage[];
  /** Changes the messages of that case (it may no longer be the current one when a late reply comes). */
  update(caseId: string, fn: (messages: CaseMessage[]) => CaseMessage[]): void;
};

export interface CaseStore {
  /** Saved cases, last used first (at most 20). */
  listRecent(): Promise<Case[]>;
  get(id: string): Promise<Case | null>;
  /** Saves the case (only what may be kept) and returns the recent list; the oldest past 20 go. */
  save(c: Case): Promise<Case[]>;
  /** A new, empty case. It is saved only once it has a message. */
  startNew(now: Date): Case;
  /** On app open: the last case if it was used in the last 4 hours, otherwise a new case. */
  openOnStart(now: Date): Promise<{ current: Case; recent: Case[] }>;
  /** "Dr. Avery, lap chole", or "Case 7:42" (its start time) while the surgeon is unknown. */
  label(c: Case): string;
  /** When a case was last used, the short way: "7:10", "Yesterday", "Mon", "Nov 3". */
  when(c: Case, now: Date): string;
}
