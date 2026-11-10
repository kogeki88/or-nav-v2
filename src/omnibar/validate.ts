// Checks what the AI returned against the phone's own copy, and turns drafts into review requests.
// Pure TypeScript (Node-tested). Never trusts an id from the AI: unknown ids drop the action.
import type { DraftCard, DraftCardLine, DraftItem, OmniAction } from '../../supabase/functions/omnibar/schema';
import type { Card, Item, LibraryData, NewChange } from '../contracts/library';

// The offline plain search, kept as it was when the Library box moved to the search engine
// (ticket #7): every typed word starts a word in name, category, shelf, bin or other names.
const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function matches(query: string, ...hay: (string | null | undefined)[]): boolean {
  const q = norm(query).split(' ').filter(Boolean);
  if (q.length === 0) return true;
  const words = hay.flatMap((h) => norm(h).split(' ')).filter(Boolean);
  return q.every((part) => words.some((w) => w.startsWith(part)));
}

function searchItems(items: Item[], query: string): Item[] {
  return items
    .filter((i) => matches(query, i.name, i.category, i.shelf, i.sub_location, ...i.synonyms))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function searchCards(cards: Card[], query: string): Card[] {
  return cards
    .filter((c) => matches(query, c.surgeon, c.procedure, c.specialty))
    .sort((a, b) => a.procedure.localeCompare(b.procedure) || a.surgeon.localeCompare(b.surgeon));
}

export type Draft = DraftItem | DraftCard | DraftCardLine;

function inDept<T extends { id: string; department_id: string }>(rows: T[], id: string | null | undefined, deptId: string): T | undefined {
  return id ? rows.find((r) => r.id === id && r.department_id === deptId) : undefined;
}

/** Keeps only actions whose ids exist in this department (or in the user's departments). */
export function validActions(actions: OmniAction[], data: LibraryData, deptId: string, myDeptIds: string[]): OmniAction[] {
  const out: OmniAction[] = [];
  for (const a of actions) {
    switch (a.type) {
      case 'open_item':
        if (inDept(data.items, a.item_id, deptId)) out.push(a);
        break;
      case 'open_card':
        if (inDept(data.cards, a.card_id, deptId)) out.push(a);
        break;
      case 'show_results': {
        const item_ids = (a.item_ids ?? []).filter((id) => inDept(data.items, id, deptId));
        const card_ids = (a.card_ids ?? []).filter((id) => inDept(data.cards, id, deptId));
        if (item_ids.length + card_ids.length > 0) out.push({ type: 'show_results', item_ids, card_ids });
        break;
      }
      case 'switch_department':
        if (myDeptIds.includes(a.department_id) && a.department_id !== deptId) out.push(a);
        break;
      case 'go_to':
        if (a.tab === 'library' || a.tab === 'review' || a.tab === 'me') out.push(a);
        break;
      case 'draft_item':
      case 'draft_card':
      case 'draft_card_line':
        if (draftToChange(a, data, deptId)) out.push(a);
        break;
    }
  }
  return out;
}

/** Only the fields the draft sets (null means "leave as is"). */
function pick(draft: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = draft[k];
    if (v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '')) out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

/** The review request a draft becomes, or null when the draft is not valid for this department. */
export function draftToChange(d: Draft, data: LibraryData, deptId: string): NewChange | null {
  if (d.type === 'draft_item') {
    const fields = pick(d, ['name', 'category', 'shelf', 'sub_location', 'synonyms', 'notes']);
    if (d.kind === 'add') {
      if (!fields.name) return null;
      return { department_id: deptId, kind: 'add', target: 'item', target_id: null, data: fields, base_version: null };
    }
    const row = inDept(data.items, d.item_id, deptId);
    if (!row) return null;
    if (d.kind === 'edit' && Object.keys(fields).length === 0) return null;
    return { department_id: deptId, kind: d.kind, target: 'item', target_id: row.id, data: d.kind === 'remove' ? {} : fields, base_version: row.version };
  }

  if (d.type === 'draft_card') {
    const fields = pick(d, ['surgeon', 'procedure', 'specialty', 'notes']);
    if (d.kind === 'add') {
      if (!fields.surgeon || !fields.procedure) return null;
      return { department_id: deptId, kind: 'add', target: 'card', target_id: null, data: fields, base_version: null };
    }
    const row = inDept(data.cards, d.card_id, deptId);
    if (!row) return null;
    if (d.kind === 'edit' && Object.keys(fields).length === 0) return null;
    return { department_id: deptId, kind: d.kind, target: 'card', target_id: row.id, data: d.kind === 'remove' ? {} : fields, base_version: row.version };
  }

  // draft_card_line
  const card = inDept(data.cards, d.card_id, deptId);
  if (!card) return null;
  const fields = pick(d, ['phase', 'quantity', 'open_or_hold', 'note']);
  if (typeof fields.quantity === 'number' && (!Number.isInteger(fields.quantity) || fields.quantity < 1 || fields.quantity > 999)) return null;
  if (d.kind === 'add') {
    const item = inDept(data.items, d.item_id, deptId);
    if (!item || !fields.phase) return null;
    return {
      department_id: deptId,
      kind: 'add',
      target: 'card_item',
      target_id: null,
      data: { card_id: card.id, item_id: item.id, quantity: 1, open_or_hold: 'open', ...fields },
      base_version: null,
    };
  }
  const line = data.cardItems.find((ci) => ci.id === d.card_item_id && ci.card_id === card.id && ci.department_id === deptId);
  if (!line) return null;
  if (d.kind === 'edit' && Object.keys(fields).length === 0) return null;
  return { department_id: deptId, kind: d.kind, target: 'card_item', target_id: line.id, data: d.kind === 'remove' ? {} : fields, base_version: null };
}

/** Offline answer: plain search of the phone copy. */
const FILLER = new Set(
  'where whats what which is are the a an find show me my get i need we do does did use uses using for on in at of to please can you tell about with have has any our there'.split(' '),
);

export function localAnswer(question: string, data: LibraryData, deptId: string): { reply: string; actions: OmniAction[] } {
  const query = question
    .toLowerCase()
    .replace(/[?.!,']/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(' ');
  const items = searchItems(data.items.filter((i) => i.department_id === deptId), query).slice(0, 8);
  const cards = searchCards(data.cards.filter((c) => c.department_id === deptId), query).slice(0, 5);
  if (items.length + cards.length === 0) {
    return { reply: "You're offline, so the assistant can't answer. No saved items or cards match those words.", actions: [] };
  }
  return {
    reply: "You're offline, so here are plain search matches from your saved copy.",
    actions: [{ type: 'show_results', item_ids: items.map((i) => i.id), card_ids: cards.map((c) => c.id) }],
  };
}
