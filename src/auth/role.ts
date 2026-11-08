// Account role. Pure TypeScript so Node can test it.
// The role lives in Supabase app_metadata, which only the Supabase dashboard or server can change.
export type Role = 'admin' | 'user';

export function roleOf(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): Role {
  return user?.app_metadata?.role === 'admin' ? 'admin' : 'user';
}
