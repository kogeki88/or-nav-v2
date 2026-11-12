// What the omnibar AI may answer: a short reply plus actions for the app.
// Shared by the server (JSON schema in the prompt, answer check) and the app (types + checks).
// The AI never changes data: "draft_*" actions only fill a suggestion the nurse checks and sends for review.

export const PHASE_NAMES = ['Setup', 'Incision', 'Cannulation/Main', 'Closure'] as const;
export const TABS = ['library', 'review', 'me'] as const;

export type OpenItem = { type: 'open_item'; item_id: string };
export type OpenCard = { type: 'open_card'; card_id: string };
export type ShowResults = { type: 'show_results'; item_ids: string[]; card_ids: string[] };
export type DraftItem = {
  type: 'draft_item';
  kind: 'add' | 'edit' | 'remove';
  item_id: string | null;
  name: string | null;
  category: string | null;
  shelf: string | null;
  sub_location: string | null;
  synonyms: string[] | null;
  notes: string | null;
  summary: string;
};
export type DraftCard = {
  type: 'draft_card';
  kind: 'add' | 'edit' | 'remove';
  card_id: string | null;
  surgeon: string | null;
  procedure: string | null;
  specialty: string | null;
  notes: string | null;
  summary: string;
};
export type DraftCardLine = {
  type: 'draft_card_line';
  kind: 'add' | 'edit' | 'remove';
  card_id: string;
  card_item_id: string | null;
  item_id: string | null;
  phase: (typeof PHASE_NAMES)[number] | null;
  quantity: number | null;
  open_or_hold: 'open' | 'hold' | null;
  note: string | null;
  summary: string;
};
export type SwitchDepartment = { type: 'switch_department'; department_id: string };
export type GoTo = { type: 'go_to'; tab: (typeof TABS)[number] };

export type OmniAction = OpenItem | OpenCard | ShowResults | DraftItem | DraftCard | DraftCardLine | SwitchDepartment | GoTo;
export type OmniAnswer = { reply: string; actions: OmniAction[] };

const str = { type: 'string' } as const;
/** A fixed value, written as a one-item enum (not "const"). */
const one = (value: string) => ({ type: 'string', enum: [value] });
const strOrNull = { type: ['string', 'null'] } as const;
const kind = { type: 'string', enum: ['add', 'edit', 'remove'] } as const;

function obj(properties: Record<string, unknown>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

/** JSON schema for the answer. It goes into the prompt (JSON_RULES), and answer.ts checks every answer against it. */
export const ANSWER_SCHEMA = obj({
  reply: { ...str, description: 'Short plain answer for the nurse, 1-3 sentences.' },
  actions: {
    type: 'array',
    items: {
      anyOf: [
        obj({ type: one('open_item'), item_id: str }),
        obj({ type: one('open_card'), card_id: str }),
        obj({ type: one('show_results'), item_ids: { type: 'array', items: str }, card_ids: { type: 'array', items: str } }),
        obj({
          type: one('draft_item'),
          kind,
          item_id: strOrNull,
          name: strOrNull,
          category: strOrNull,
          shelf: strOrNull,
          sub_location: strOrNull,
          synonyms: { type: ['array', 'null'], items: str },
          notes: strOrNull,
          summary: str,
        }),
        obj({
          type: one('draft_card'),
          kind,
          card_id: strOrNull,
          surgeon: strOrNull,
          procedure: strOrNull,
          specialty: strOrNull,
          notes: strOrNull,
          summary: str,
        }),
        obj({
          type: one('draft_card_line'),
          kind,
          card_id: str,
          card_item_id: strOrNull,
          item_id: strOrNull,
          phase: { type: ['string', 'null'], enum: [...PHASE_NAMES, null] },
          quantity: { type: ['integer', 'null'] },
          open_or_hold: { type: ['string', 'null'], enum: ['open', 'hold', null] },
          note: strOrNull,
          summary: str,
        }),
        obj({ type: one('switch_department'), department_id: str }),
        obj({ type: one('go_to'), tab: { type: 'string', enum: [...TABS] } }),
      ],
    },
  },
});

/** One turn of the chat, as the app sends it (already scrubbed). */
export type OmniTurn = { role: 'user' | 'assistant'; text: string };

/** The shape of a database id (department, card). */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The case the nurse is working on. */
export type OmniCase = { surgeon: string | null; procedure: string | null; card_id: string | null };
/** The request body the app sends to the omnibar function. case: optional; old app versions do not send it. */
export type OmniRequest = { message: string; history: OmniTurn[]; department_id: string; case?: OmniCase };
