// A case as a row of the `cases` table (migration v3) and back. Pure TypeScript.
import type { Case, CaseMessage } from '../../contracts/cases';

export type CaseRow = {
  id: string;
  created_at: string;
  last_used_at: string;
  surgeon: string | null;
  procedure: string | null;
  card_id: string | null;
  set_by_nurse: number;
  /** JSON list of messages. */
  messages: string;
};

export function toCaseRow(c: Case): CaseRow {
  return {
    id: c.id,
    created_at: c.createdAt,
    last_used_at: c.lastUsedAt,
    surgeon: c.surgeon,
    procedure: c.procedure,
    card_id: c.cardId,
    set_by_nurse: c.setByNurse ? 1 : 0,
    messages: JSON.stringify(c.messages),
  };
}

function parseMessages(text: string): CaseMessage[] {
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? (list as CaseMessage[]) : [];
  } catch {
    return [];
  }
}

export function fromCaseRow(r: CaseRow): Case {
  return {
    id: r.id,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    surgeon: r.surgeon,
    procedure: r.procedure,
    cardId: r.card_id,
    setByNurse: Boolean(r.set_by_nurse),
    messages: parseMessages(r.messages),
  };
}
