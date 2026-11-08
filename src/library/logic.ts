// Pure library logic (no React Native imports), so Node tests can run it directly.
import type { Card, CardItem, ChangeRequest, Department, Hospital, Item, LibraryData, Target } from './types';

/** Fields a person can edit, in the order the edit form and the review screen show them. */
export const FIELDS: Record<'item' | 'card', { key: string; label: string; multiline?: boolean; list?: boolean; required?: boolean }[]> = {
  item: [
    { key: 'name', label: 'Name', required: true },
    { key: 'category', label: 'Category' },
    { key: 'shelf', label: 'Shelf' },
    { key: 'sub_location', label: 'Bin or spot' },
    { key: 'synonyms', label: 'Also called', list: true },
    { key: 'notes', label: 'Notes', multiline: true },
  ],
  card: [
    { key: 'surgeon', label: 'Surgeon', required: true },
    { key: 'procedure', label: 'Procedure', required: true },
    { key: 'specialty', label: 'Specialty' },
    { key: 'notes', label: 'Notes', multiline: true },
  ],
};

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** True when every word of the query starts a word somewhere in the haystack. */
export function matches(query: string, ...hay: (string | null | undefined)[]): boolean {
  const q = norm(query).split(' ').filter(Boolean);
  if (q.length === 0) return true;
  const words = hay.flatMap((h) => norm(h).split(' ')).filter(Boolean);
  return q.every((part) => words.some((w) => w.startsWith(part)));
}

export function searchItems(items: Item[], query: string): Item[] {
  return items
    .filter((i) => matches(query, i.name, i.category, i.shelf, i.sub_location, ...i.synonyms))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function searchCards(cards: Card[], query: string): Card[] {
  return cards
    .filter((c) => matches(query, c.surgeon, c.procedure, c.specialty))
    .sort((a, b) => a.procedure.localeCompare(b.procedure) || a.surgeon.localeCompare(b.surgeon));
}

export function itemLocation(i: Pick<Item, 'shelf' | 'sub_location'>): string {
  return [i.shelf, i.sub_location].filter(Boolean).join(' · ') || 'No location yet';
}

export function cardSubtitle(c: Pick<Card, 'surgeon' | 'specialty'>): string {
  return [c.surgeon, c.specialty].filter(Boolean).join(' · ');
}

/** Pending requests that touch this row. */
export function pendingFor(requests: ChangeRequest[], target: Target, id: string): ChangeRequest[] {
  return requests.filter((r) => r.status === 'pending' && r.target === target && r.target_id === id);
}

/** Departments the user belongs to, with their hospital, sorted by hospital then department. */
export function myDepartments(data: LibraryData, userId: string): { department: Department; hospital: Hospital | undefined }[] {
  const mine = new Set(data.memberships.filter((m) => m.user_id === userId).map((m) => m.department_id));
  return data.departments
    .filter((d) => mine.has(d.id))
    .map((department) => ({ department, hospital: data.hospitals.find((h) => h.id === department.hospital_id) }))
    .sort((a, b) => (a.hospital?.name ?? '').localeCompare(b.hospital?.name ?? '') || a.department.name.localeCompare(b.department.name));
}

export function departmentLabel(data: LibraryData, departmentId: string | null): string {
  const d = data.departments.find((x) => x.id === departmentId);
  if (!d) return 'Choose a department';
  const h = data.hospitals.find((x) => x.id === d.hospital_id);
  return h ? `${h.name} · ${d.name}` : d.name;
}

/** Items on a card, grouped by phase in OR order. */
export function cardLines(data: LibraryData, cardId: string): { phase: string; lines: { line: CardItem; item: Item | undefined }[] }[] {
  const lines = data.cardItems
    .filter((ci) => ci.card_id === cardId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((line) => ({ line, item: data.items.find((i) => i.id === line.item_id) }));
  const phases = ['Setup', 'Incision', 'Cannulation/Main', 'Closure'];
  return phases.map((phase) => ({ phase, lines: lines.filter((l) => l.line.phase === phase) })).filter((g) => g.lines.length > 0);
}

/** Cards that use this item. */
export function cardsUsing(data: LibraryData, itemId: string): Card[] {
  const ids = new Set(data.cardItems.filter((ci) => ci.item_id === itemId).map((ci) => ci.card_id));
  return data.cards.filter((c) => ids.has(c.id));
}

export function show(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/**
 * Turns form text into the change data: only fields that differ from the current row.
 * Empty text becomes null; "Also called" splits on commas.
 */
export function changedFields(
  target: 'item' | 'card',
  form: Record<string, string>,
  current: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[target]) {
    const raw = (form[f.key] ?? '').trim();
    const value = f.list
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : raw === ''
        ? null
        : raw.replace(/[ \t]+/g, ' ');
    const before = current?.[f.key] ?? (f.list ? [] : null);
    if (JSON.stringify(value) !== JSON.stringify(before)) out[f.key] = value;
  }
  return out;
}

/** First missing required field, as a plain sentence, or null. */
export function missingRequired(target: 'item' | 'card', form: Record<string, string>): string | null {
  const f = FIELDS[target].find((x) => x.required && (form[x.key] ?? '').trim() === '');
  return f ? `Enter the ${f.label.toLowerCase()}.` : null;
}

/** The rows the review screen shows: field, before, after. */
export function reviewRows(data: LibraryData, r: ChangeRequest): { label: string; before: string; after: string }[] {
  if (r.target === 'card_item') {
    const line = data.cardItems.find((ci) => ci.id === r.target_id) as Record<string, unknown> | undefined;
    const cardId = (r.data.card_id as string | undefined) ?? (line?.card_id as string | undefined);
    const itemId = (r.data.item_id as string | undefined) ?? (line?.item_id as string | undefined);
    const card = data.cards.find((c) => c.id === cardId);
    const item = data.items.find((i) => i.id === itemId);
    const fixed = [
      { label: 'Card', before: card ? `${card.procedure} · ${card.surgeon}` : '—', after: card ? `${card.procedure} · ${card.surgeon}` : '—' },
      { label: 'Item', before: item?.name ?? '—', after: item?.name ?? '—' },
    ];
    const fields = [
      { key: 'phase', label: 'Phase' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'open_or_hold', label: 'Open or hold' },
      { key: 'note', label: 'Note' },
    ].filter((f) => r.kind === 'remove' || f.key in r.data);
    return [
      ...fixed,
      ...fields.map((f) => ({
        label: f.label,
        before: r.kind === 'add' ? '—' : show(line?.[f.key]),
        after: r.kind === 'remove' ? '—' : show(r.data[f.key]),
      })),
    ];
  }
  const current =
    r.target === 'item'
      ? (data.items.find((i) => i.id === r.target_id) as Record<string, unknown> | undefined)
      : (data.cards.find((c) => c.id === r.target_id) as Record<string, unknown> | undefined);
  return FIELDS[r.target]
    .filter((f) => r.kind === 'remove' || f.key in r.data)
    .map((f) => ({
      label: f.label,
      before: r.kind === 'add' ? '—' : show(current?.[f.key]),
      after: r.kind === 'remove' ? '—' : show(r.data[f.key]),
    }));
}

/** Short title for a request, for lists. */
export function requestTitle(data: LibraryData, r: ChangeRequest): string {
  const verb = r.kind === 'add' ? 'New' : r.kind === 'edit' ? 'Edit' : 'Remove';
  if (r.target === 'item') {
    const name = (r.data.name as string | undefined) ?? data.items.find((i) => i.id === r.target_id)?.name ?? 'item';
    return `${verb} item: ${name}`;
  }
  if (r.target === 'card') {
    const c = data.cards.find((x) => x.id === r.target_id);
    const proc = (r.data.procedure as string | undefined) ?? c?.procedure ?? 'card';
    return `${verb} card: ${proc}`;
  }
  const line = data.cardItems.find((ci) => ci.id === r.target_id);
  const card = data.cards.find((c) => c.id === ((r.data.card_id as string | undefined) ?? line?.card_id));
  const item = data.items.find((i) => i.id === ((r.data.item_id as string | undefined) ?? line?.item_id));
  const what = item?.name ?? 'item';
  const where = card ? ` · ${card.procedure}` : '';
  if (r.kind === 'add') return `Add to card: ${what}${where}`;
  if (r.kind === 'remove') return `Remove from card: ${what}${where}`;
  return `Change on card: ${what}${where}`;
}

/** Requests the user can review: pending, in their departments, not their own. */
export function toReview(data: LibraryData, userId: string): ChangeRequest[] {
  const mine = new Set(data.memberships.filter((m) => m.user_id === userId).map((m) => m.department_id));
  return data.requests
    .filter((r) => r.status === 'pending' && r.proposed_by !== userId && mine.has(r.department_id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function myPending(data: LibraryData, userId: string): ChangeRequest[] {
  return data.requests
    .filter((r) => r.status === 'pending' && r.proposed_by === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
