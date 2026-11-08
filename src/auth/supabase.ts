// OR-Nav online accounts (Supabase). Setup follows the Expo SDK 58 Supabase guide.
// Offline rule: once signed in, the app stays signed in without internet until Sign out
// or until Supabase itself ends the session (for example, the account is removed).
import 'expo-sqlite/localStorage/install';
import { createClient, type AuthError } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** False when the build has no Supabase settings (.env or CI secrets missing). */
export const authConfigured = url !== '' && publishableKey !== '';

export const supabase = createClient(url || 'https://not-configured.invalid', publishableKey || 'missing', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is on screen (Supabase's React Native pattern).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Who is signed in, kept by OR-Nav so the answer works offline. */
export type SignedInUser = { id: string; email: string };
const USER_KEY = 'ornav.signedInUser';

export function readSignedInUser(): SignedInUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SignedInUser) : null;
  } catch {
    return null;
  }
}

function writeSignedInUser(user: SignedInUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

/** Calls back with the signed-in user (or null) whenever Supabase reports a change. */
export function watchSignedInUser(onChange: (user: SignedInUser | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      writeSignedInUser(null);
      onChange(null);
    } else if (session?.user && event !== 'INITIAL_SESSION') {
      const user = { id: session.user.id, email: session.user.email ?? '' };
      writeSignedInUser(user);
      onChange(user);
    }
  });
  return () => data.subscription.unsubscribe();
}

/** Turns Supabase and network errors into plain words. */
export function friendlyAuthError(error: AuthError | Error): string {
  const code = 'code' in error ? (error as AuthError).code : undefined;
  if (code === 'invalid_credentials') return 'Wrong email or password.';
  if (code === 'email_not_confirmed') return 'Confirm your email first: open the link we sent you, then sign in.';
  if (code === 'user_already_exists') return 'An account with this email already exists. Sign in instead.';
  if (code === 'weak_password') return 'Password is too weak. Use at least 8 characters.';
  if (code === 'over_email_send_rate_limit') return 'Too many emails sent. Wait a few minutes and try again.';
  if (/network|fetch/i.test(error.message)) return 'No internet. Signing in needs internet once; after that OR-Nav works offline.';
  return error.message;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error));
}

/** Returns true if the user must confirm their email before signing in. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error));
  return data.session === null;
}

/** Signs out on this phone. Works offline: the local sign-in is always cleared. */
export async function signOut(): Promise<void> {
  writeSignedInUser(null);
  await supabase.auth.signOut({ scope: 'local' });
}
