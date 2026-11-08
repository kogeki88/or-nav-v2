// Shared library state for the Library, To review and Me tabs.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { myDepartments } from './logic';
import { friendlyDataError, readCachedLibrary } from './supabaseSource';
import { EMPTY_LIBRARY, LibraryData, LibrarySource, NewChange } from './types';

const DEPT_KEY = 'ornav.library.department';

function readSavedDept(): string | null {
  try {
    return localStorage.getItem(DEPT_KEY);
  } catch {
    return null;
  }
}

export type Library = ReturnType<typeof useLibrary>;

export function useLibrary(source: LibrarySource, userId: string, useCache: boolean) {
  const cached = useMemo(() => (useCache ? readCachedLibrary(userId) : null), [useCache, userId]);
  const [data, setData] = useState<LibraryData>(cached ?? EMPTY_LIBRARY);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [deptId, setDeptIdState] = useState<string | null>(readSavedDept);
  const live = useRef(true);

  const refresh = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      try {
        const next = await source.load();
        if (!live.current) return;
        setData(next);
        setError('');
        setOffline(false);
      } catch (e) {
        if (!live.current) return;
        const msg = friendlyDataError(e);
        setError(msg);
        setOffline(/offline/i.test(msg));
      } finally {
        if (live.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [source],
  );

  useEffect(() => {
    live.current = true;
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      live.current = false;
      sub.remove();
    };
  }, [refresh]);

  const mine = useMemo(() => myDepartments(data, userId), [data, userId]);

  // Keep the chosen department valid: fall back to the first one the user belongs to.
  const activeDept = mine.some((m) => m.department.id === deptId) ? deptId : (mine[0]?.department.id ?? null);

  const setDept = useCallback((id: string) => {
    setDeptIdState(id);
    try {
      localStorage.setItem(DEPT_KEY, id);
    } catch {
      // Not critical.
    }
  }, []);

  /** Runs a write, then reloads. Throws a plain-language message on failure. */
  const act = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        const out = await fn();
        await refresh();
        return out;
      } catch (e) {
        throw new Error(friendlyDataError(e));
      }
    },
    [refresh],
  );

  return {
    data,
    loading,
    refreshing,
    error,
    offline,
    userId,
    mine,
    deptId: activeDept,
    setDept,
    refresh,
    join: (id: string, jobRole: string | null) => act(() => source.join(id, jobRole)).then(() => setDept(id)),
    leave: (id: string) => act(() => source.leave(id)),
    propose: (c: NewChange) => act(() => source.propose(c)),
    review: (id: string, d: 'approve' | 'reject', note?: string) => act(() => source.review(id, d, note)),
  };
}
