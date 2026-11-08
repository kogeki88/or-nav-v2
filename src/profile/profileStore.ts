// Profile storage: a copy on the phone (works offline) plus the Supabase profiles table.
// Offline saves are marked pendingSync and sent the next time the app is online.
import { supabase } from '../auth/supabase';
import type { ProfileRow } from './profile';

export const PROFILE_KEY = 'ornav.profile';

type Cached = { userId: string; row: ProfileRow; pendingSync: boolean };

function readCache(userId: string): Cached | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    return cached.userId === userId ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(cached: Cached) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(cached));
}

async function upload(userId: string, row: ProfileRow): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...row, updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}

/**
 * The user's profile, or null when they still need the questionnaire.
 * Order: phone copy (sending it if it was saved offline), then the server.
 */
export async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const cached = readCache(userId);
  if (cached) {
    if (cached.pendingSync && (await upload(userId, cached.row))) {
      writeCache({ ...cached, pendingSync: false });
    }
    return cached.row;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name,nickname,facility,department,role,avatar_emoji,favorite_specialty,years_in_or,walkup_song')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    writeCache({ userId, row: data as ProfileRow, pendingSync: false });
    return data as ProfileRow;
  } catch {
    return null; // offline with no phone copy: ask the questions; the answers sync later
  }
}

/** Phone copy at once; then Supabase. Returns false if it could only be saved on the phone. */
export async function saveProfile(userId: string, row: ProfileRow): Promise<boolean> {
  writeCache({ userId, row, pendingSync: true });
  const ok = await upload(userId, row);
  if (ok) writeCache({ userId, row, pendingSync: false });
  return ok;
}
