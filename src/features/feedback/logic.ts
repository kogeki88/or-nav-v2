// The feedback button's plain rules (no React): who sees it, and the page name a report carries.
import type { FeedbackTag } from '../../contracts/feedback';

/** Only a signed-in admin sees the button. No user = the sign-in page. */
export function showFeedbackButton(user: { id: string; role: string | null } | null): boolean {
  return user !== null && user.role === 'admin';
}

export type OpenPanels = { sidebar: boolean; case: boolean; name: boolean; department: boolean; item: boolean };

const PANEL_NAME: Record<keyof OpenPanels, string> = {
  case: 'case panel',
  item: 'library sheet',
  department: 'department sheet',
  name: 'name sheet',
  sidebar: 'sidebar',
};

/** "main", or "main / case panel" when a panel is open (the top one, in the order they draw). */
export function feedbackPage(view: string, panels: OpenPanels): string {
  const open = (['item', 'department', 'name', 'case', 'sidebar'] as const).find((k) => panels[k]);
  return open ? `${view} / ${PANEL_NAME[open]}` : view;
}

export const TAGS: { key: FeedbackTag; label: string }[] = [
  { key: 'broken', label: 'Broken' },
  { key: 'looks_wrong', label: 'Looks wrong' },
  { key: 'idea', label: 'Idea' },
];
