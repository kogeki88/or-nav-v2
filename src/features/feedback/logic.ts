// The feedback button's plain rules (no React): who sees it, what the tags are, when Send is allowed, and the page name.
// Pure TypeScript so Node can test it.
import type { FeedbackTag } from '../../contracts/feedback';
import type { IconName } from '../../ui/kit';

export const FEEDBACK_TAGS: { key: FeedbackTag; label: string; icon: IconName }[] = [
  { key: 'broken', label: 'Broken', icon: 'alert-octagon' },
  { key: 'looks_wrong', label: 'Looks wrong', icon: 'eye' },
  { key: 'idea', label: 'Idea', icon: 'zap' },
];

/** Most characters a message may hold after trimming (the table has the same limit). */
export const MAX_FEEDBACK_MESSAGE = 2000;

/** Admins only, signed in, and never in demo mode. Nurses never see the button. */
export function showFeedbackButton(input: { isAdmin: boolean; signedIn: boolean; demo: boolean }): boolean {
  return input.isAdmin && input.signedIn && !input.demo;
}

/** Send needs a message: at least one character after trimming, at most MAX_FEEDBACK_MESSAGE. */
export function canSendFeedback(message: string): boolean {
  const length = message.trim().length;
  return length > 0 && length <= MAX_FEEDBACK_MESSAGE;
}

export type PageInput = {
  view: 'main' | 'library' | 'review' | 'admin';
  sidebar: boolean;
  caseOpen: boolean;
  nameOpen: boolean;
  deptOpen: boolean;
  /** A library item or card is open in its sheet. */
  libraryOpen: boolean;
};

const VIEW_NAMES: Record<PageInput['view'], string> = {
  main: 'Main screen',
  library: 'Library',
  review: 'To review',
  admin: 'Admin tools',
};

/** The page name in a report: the screen, then each open panel, joined with " + ". */
export function pageName(p: PageInput): string {
  const parts = [VIEW_NAMES[p.view]];
  if (p.sidebar) parts.push('sidebar');
  if (p.caseOpen) parts.push('case panel');
  if (p.nameOpen) parts.push('name panel');
  if (p.deptOpen) parts.push('department panel');
  if (p.libraryOpen) parts.push('library item');
  return parts.join(' + ');
}
