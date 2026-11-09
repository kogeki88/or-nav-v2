// Shapes of the multi-tenant tables (supabase/migrations/0002_tenants.sql).

export type Hospital = { id: string; name: string; city: string | null };
export type Department = { id: string; hospital_id: string; name: string };
export type Membership = { user_id: string; department_id: string; job_role: string | null };

export type Item = {
  id: string;
  department_id: string;
  name: string;
  category: string | null;
  shelf: string | null;
  sub_location: string | null;
  synonyms: string[];
  notes: string | null;
  photo_path: string | null;
  version: number;
};

export type Card = {
  id: string;
  department_id: string;
  surgeon: string;
  procedure: string;
  specialty: string | null;
  notes: string | null;
  version: number;
};

export const PHASES = ['Setup', 'Incision', 'Cannulation/Main', 'Closure'] as const;
export type Phase = (typeof PHASES)[number];

export type CardItem = {
  id: string;
  department_id: string;
  card_id: string;
  item_id: string;
  phase: Phase;
  quantity: number;
  open_or_hold: 'open' | 'hold';
  note: string | null;
  sort_order: number;
};

export type Target = 'item' | 'card' | 'card_item';
export type Kind = 'add' | 'edit' | 'remove';
export type Status = 'pending' | 'approved' | 'rejected';

export type ChangeRequest = {
  id: string;
  department_id: string;
  proposed_by: string;
  kind: Kind;
  target: Target;
  target_id: string | null;
  data: Record<string, unknown>;
  base_version: number | null;
  status: Status;
  created_at: string;
};

export type NewChange = Omit<ChangeRequest, 'id' | 'proposed_by' | 'status' | 'created_at'>;

/** Everything the Library and To review screens need, for the signed-in user. */
export type LibraryData = {
  hospitals: Hospital[];
  departments: Department[];
  memberships: Membership[];
  items: Item[];
  cards: Card[];
  cardItems: CardItem[];
  requests: ChangeRequest[];
  /** When this copy came from the server (ISO time). */
  loadedAt: string;
};

export const EMPTY_LIBRARY: LibraryData = {
  hospitals: [],
  departments: [],
  memberships: [],
  items: [],
  cards: [],
  cardItems: [],
  requests: [],
  loadedAt: '',
};

/** The one place screens read and write library data. Supabase in the app, sample data in demo mode. */
export interface LibrarySource {
  load(): Promise<LibraryData>;
  join(departmentId: string, jobRole: string | null): Promise<void>;
  leave(departmentId: string): Promise<void>;
  propose(change: NewChange): Promise<void>;
  review(requestId: string, decision: 'approve' | 'reject', note?: string): Promise<'approved' | 'rejected'>;
  /** The library copy saved on the phone for the signed-in user, or null when there is none. */
  savedCopy(): Promise<LibraryData | null>;
  /** The plain-language message the nurse sees for this error. */
  explainError(e: unknown): string;
}
