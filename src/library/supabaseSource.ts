// Library data from Supabase, with a phone copy so the Library still opens offline.
// The server's row-level security decides what this user may see and do.
import { supabase } from '../auth/supabase';
import type { LibraryData, LibrarySource, NewChange } from './types';

const cacheKey = (userId: string) => `ornav.library.${userId}`;

export function readCachedLibrary(userId: string): LibraryData | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as LibraryData) : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, data: LibraryData) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data));
  } catch {
    // Not critical: the next open loads from the server again.
  }
}

/** Plain-language message for server errors. */
export function friendlyDataError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/network|fetch|timed? ?out/i.test(msg)) return "You're offline. Connect to the internet and try again.";
  if (/relation .* does not exist|schema cache/i.test(msg)) return 'The server is not set up for the library yet. Run 0002_tenants.sql in Supabase.';
  if (/permission denied|row-level security/i.test(msg)) return "You don't have access to that department.";
  return msg;
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export function supabaseSource(userId: string): LibrarySource {
  return {
    async load() {
      const [hospitals, departments, memberships, items, cards, cardItems, requests] = await Promise.all([
        rows(supabase.from('hospitals').select('id,name,city').order('name')),
        rows(supabase.from('departments').select('id,hospital_id,name').order('name')),
        rows(supabase.from('memberships').select('user_id,department_id,job_role')),
        rows(supabase.from('items').select('id,department_id,name,category,shelf,sub_location,synonyms,notes,photo_path,version')),
        rows(supabase.from('preference_cards').select('id,department_id,surgeon,procedure,specialty,notes,version')),
        rows(supabase.from('card_items').select('id,department_id,card_id,item_id,phase,quantity,open_or_hold,note,sort_order')),
        rows(
          supabase
            .from('change_requests')
            .select('id,department_id,proposed_by,kind,target,target_id,data,base_version,status,created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        ),
      ]);
      const data = { hospitals, departments, memberships, items, cards, cardItems, requests, loadedAt: new Date().toISOString() } as LibraryData;
      writeCache(userId, data);
      return data;
    },

    async join(departmentId, jobRole) {
      const { error } = await supabase.from('memberships').insert({ user_id: userId, department_id: departmentId, job_role: jobRole });
      if (error && !/duplicate key/i.test(error.message)) throw error;
    },

    async leave(departmentId) {
      const { error } = await supabase.from('memberships').delete().eq('user_id', userId).eq('department_id', departmentId);
      if (error) throw error;
    },

    async propose(change: NewChange) {
      const { error } = await supabase.from('change_requests').insert({ ...change, proposed_by: userId });
      if (error) throw error;
    },

    async review(requestId, decision, note) {
      const { data, error } = await supabase.rpc('review_change', {
        p_request_id: requestId,
        p_decision: decision,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data as 'approved' | 'rejected';
    },
  };
}
