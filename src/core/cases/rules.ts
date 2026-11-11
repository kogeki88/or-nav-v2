// The plain rules for cases (no React, no database): which case opens, how many stay, names, what is saved.
import type { Case, CaseMessage } from '../../contracts/cases';

/** Only the last 20 cases stay on the phone. */
export const MAX_CASES = 20;
/** Coming back within 4 hours reopens the last case. */
export const REOPEN_MS = 4 * 60 * 60 * 1000;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Last used first. */
export function byLastUsed(cases: Case[]): Case[] {
  return [...cases].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

/** On app open: the last used case if it was used in the last 4 hours, otherwise null (start a new case). */
export function pickOnOpen(recent: Case[], now: Date): Case | null {
  const last = byLastUsed(recent)[0];
  if (!last) return null;
  return now.getTime() - new Date(last.lastUsedAt).getTime() <= REOPEN_MS ? last : null;
}

/** Keeps the last 20 used; the ones that were used longest ago go first. */
export function keepLast(cases: Case[], max = MAX_CASES): { keep: Case[]; drop: string[] } {
  const sorted = byLastUsed(cases);
  return { keep: sorted.slice(0, max), drop: sorted.slice(max).map((c) => c.id) };
}

function clock(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** A case with no surgeon or procedure yet is named by its start time: "Case 7:42". */
export function caseTimeName(start: Date): string {
  return `Case ${clock(start)}`;
}

/** "Dr. Avery, lap chole" (a word in capitals, like CABG, stays as it is), or the time name. */
export function caseLabel(c: Case): string {
  if (!c.surgeon && !c.procedure) return caseTimeName(new Date(c.createdAt));
  const proc = c.procedure ?? '';
  const soft = /^[A-Z][a-z]/.test(proc) ? proc.charAt(0).toLowerCase() + proc.slice(1) : proc;
  return [c.surgeon, soft].filter(Boolean).join(', ');
}

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** When a case was last used: "7:10" today, "Yesterday", "Mon" this past week, then "Nov 3". */
export function caseWhen(c: Case, now: Date): string {
  const at = new Date(c.lastUsedAt);
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days <= 0) return clock(at);
  if (days === 1) return 'Yesterday';
  if (days < 7) return DAYS[at.getDay()];
  return `${MONTHS[at.getMonth()]} ${at.getDate()}`;
}

/** A case has something worth keeping once it has a message or a surgeon. */
export function worthSaving(c: Case): boolean {
  return toSave(c).messages.length > 0 || Boolean(c.surgeon || c.procedure);
}

function settle(m: CaseMessage): CaseMessage {
  if (!m.drafts) return m;
  const drafts: NonNullable<CaseMessage['drafts']> = {};
  for (const [k, d] of Object.entries(m.drafts)) drafts[Number(k)] = d.state === 'sending' ? { state: 'ready' } : d;
  return { ...m, drafts };
}

/**
 * What may be kept: the scrubbed messages that went to the AI and what came back. Lines made on
 * the phone (offline, privacy block) are left out. A draft still sending goes back to "ready".
 */
export function toSave(c: Case): Case {
  return { ...c, messages: c.messages.filter((m) => !m.local).map(settle) };
}
