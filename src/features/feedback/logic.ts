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

/** Where the button sits for a corner: `top` or `bottom` edge, plus `side` space from the left or right. */
export function cornerSpot(corner: Corner, edges: { top: number; bottom: number; side: number }) {
  return {
    ...(corner.startsWith('top') ? { top: edges.top } : { bottom: edges.bottom }),
    ...(corner.endsWith('left') ? { left: edges.side } : { right: edges.side }),
  };
}

/**
 * The top and bottom edges for the button (ticket #33): the top corners sit below the top bar and the
 * greeting, the bottom corners above the box and the "Pick up a case" list, so the button covers no text.
 */
export function feedbackEdges(l: {
  insetTop: number;
  insetBottom: number;
  topBar: number;
  greeting: number;
  composer: number;
  pickUp: number;
  gap: number;
}): { top: number; bottom: number } {
  return { top: l.insetTop + l.topBar + l.greeting + l.gap, bottom: l.insetBottom + l.composer + l.pickUp + l.gap };
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

/**
 * Takes the report's picture: hides the button first, so the picture shows the page as a nurse sees it
 * (ticket #23). A failed or stuck capture gives no picture (the report still goes) and logs the error only.
 */
export async function shootWithoutButton(steps: {
  hide: () => Promise<void>;
  capture: () => Promise<string>;
  onFault: (e: unknown) => void;
  /** A capture that takes longer is given up, so the form always opens. */
  timeoutMs?: number;
}): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await steps.hide();
    const stuck = new Promise<never>((_, fail) => {
      timer = setTimeout(() => fail(new Error('feedback screenshot: capture took too long')), steps.timeoutMs ?? 3000);
    });
    return await Promise.race([steps.capture(), stuck]);
  } catch (e) {
    steps.onFault(e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const TAGS: { key: FeedbackTag; label: string }[] = [
  { key: 'broken', label: 'Broken' },
  { key: 'looks_wrong', label: 'Looks wrong' },
  { key: 'idea', label: 'Idea' },
];
