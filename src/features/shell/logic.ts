// The shell's plain rules (no React): greetings, which rows show, and what Android Back closes first.

/** What fills the screen: the main screen, or a full-screen view over it. */
export type ShellView = 'main' | 'library' | 'review' | 'admin';

export type ShellState = { view: ShellView; sidebar: boolean };

export function firstName(p: { nickname: string | null; full_name: string }): string {
  return p.nickname?.trim() || p.full_name.trim().split(/\s+/)[0] || 'You';
}

/** The greeting on an empty main screen: morning from 5:00, afternoon from 12:00, evening from 17:00. */
export function timeGreeting(now: Date, name: string): [string, string] {
  const h = now.getHours();
  const part = h >= 5 && h < 12 ? 'Morning' : h >= 12 && h < 17 ? 'Afternoon' : 'Evening';
  return [`${part}, ${name}.`, 'What do you need?'];
}

export type SidebarRow = { key: 'new' | 'library' | 'review'; label: string; count?: number };

/** To review shows only when something waits for this nurse. */
export function sidebarRows(waiting: number): SidebarRow[] {
  const rows: SidebarRow[] = [
    { key: 'new', label: 'New case' },
    { key: 'library', label: 'Library' },
  ];
  if (waiting > 0) rows.push({ key: 'review', label: 'To review', count: waiting });
  return rows;
}

export type NameSheetRow = 'department' | 'updates' | 'admin' | 'signout';

/** Admin tools is for admins only (display only; the server checks the role again). */
export function nameSheetRows(isAdmin: boolean): NameSheetRow[] {
  return isAdmin ? ['department', 'updates', 'admin', 'signout'] : ['department', 'updates', 'signout'];
}

/** Android Back: close the sidebar, then a full-screen view. Null = nothing is open, let Android handle it. */
export function backStep(s: ShellState): ShellState | null {
  if (s.sidebar) return { ...s, sidebar: false };
  if (s.view !== 'main') return { ...s, view: 'main' };
  return null;
}
