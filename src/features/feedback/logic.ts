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

/** The four places the button can sit. Bottom right is the default, above the box. */
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const DEFAULT_CORNER: Corner = 'bottom-right';
const CORNERS: readonly Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** The corner nearest to where the button is dropped (x, y on a width x height screen). */
export function nearestCorner(x: number, y: number, width: number, height: number): Corner {
  const top = y < height / 2;
  const left = x < width / 2;
  return top ? (left ? 'top-left' : 'top-right') : left ? 'bottom-left' : 'bottom-right';
}

/** Finger moves of up to 10 points still count as a tap, so a shaky tap opens the form. */
const TAP_SLOP = 10;
export function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > TAP_SLOP;
}

/** The saved corner, or the default when nothing (or something unknown) is saved. */
export function readCorner(saved: string | null): Corner {
  return CORNERS.find((c) => c === saved) ?? DEFAULT_CORNER;
}

export const TAGS: { key: FeedbackTag; label: string }[] = [
  { key: 'broken', label: 'Broken' },
  { key: 'looks_wrong', label: 'Looks wrong' },
  { key: 'idea', label: 'Idea' },
];
