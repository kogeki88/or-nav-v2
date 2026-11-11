// The cases on this phone: the current case, the recent list, new case and switching.
// Every change is saved through the case store (the cases port); only what may be kept is stored.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Case, CaseLearning, CaseListRow, CaseMessage, CaseStore, CaseThread } from '../../contracts/cases';
import type { Card } from '../../contracts/library';
import { logFault } from '../../diag/faultStore';

/** How many other cases "Pick up a case" shows on an empty case. */
const PICK_UP = 3;

const isKnown = (c: Case) => Boolean(c.surgeon || c.procedure);

export function useCases(store: CaseStore, learning: CaseLearning) {
  const [current, setCurrent] = useState<Case | null>(null);
  const [recent, setRecent] = useState<Case[]>([]);
  // Goes up each time the current case learns by itself, so the label can play its ring once.
  const [learned, setLearned] = useState(0);
  // The newest copy of every case seen in this run, by id, so a late reply lands in its own case.
  const known = useRef(new Map<string, Case>());
  const currentId = useRef<string | null>(null);
  const liveStore = useRef(store);
  liveStore.current = store;

  const show = useCallback((c: Case) => {
    known.current.set(c.id, c);
    currentId.current = c.id;
    setCurrent(c);
  }, []);

  useEffect(() => {
    let live = true;
    known.current = new Map();
    currentId.current = null;
    setCurrent(null);
    setRecent([]);
    store
      .openOnStart(new Date())
      .then((open) => {
        if (!live) return;
        for (const c of open.recent) known.current.set(c.id, c);
        setRecent(open.recent);
        show(open.current);
      })
      .catch((e) => {
        logFault('database', e);
        if (live) show(store.startNew(new Date()));
      });
    return () => {
      live = false;
    };
  }, [store, show]);

  const persist = useCallback(
    (c: Case) => {
      store
        .save(c)
        .then((list) => liveStore.current === store && setRecent(list))
        .catch((e) => logFault('database', e));
    },
    [store],
  );

  /** Changes a case (current or not), marks it used now, and saves it. */
  const change = useCallback(
    (caseId: string, fn: (c: Case) => Case) => {
      const prev = known.current.get(caseId);
      if (!prev) return;
      const next = { ...fn(prev), lastUsedAt: new Date().toISOString() };
      known.current.set(caseId, next);
      if (currentId.current === caseId) setCurrent(next);
      persist(next);
    },
    [persist],
  );

  const startNew = useCallback(() => show(store.startNew(new Date())), [show, store]);

  const switchTo = useCallback(
    (id: string) => {
      if (id === currentId.current) return;
      const c = known.current.get(id) ?? recent.find((r) => r.id === id);
      if (!c) return;
      const touched = { ...c, lastUsedAt: new Date().toISOString() };
      show(touched);
      persist(touched);
    },
    [persist, recent, show],
  );

  /** Applies a learning rule to the current case; saves it only when something changed. */
  const teach = useCallback(
    (rule: (c: Case) => Case, byHand: boolean) => {
      const id = currentId.current;
      const prev = id ? known.current.get(id) : undefined;
      if (!id || !prev) return;
      const next = rule(prev);
      if (next === prev) return;
      change(id, () => next);
      if (!byHand && isKnown(next)) setLearned((n) => n + 1);
    },
    [change],
  );

  const learnCard = useCallback((card: Card) => teach((c) => learning.fromCard(c, card), false), [learning, teach]);
  const learnText = useCallback((text: string, cards: Card[]) => teach((c) => learning.fromText(c, text, cards), false), [learning, teach]);
  const setByHand = useCallback((card: Card | null) => teach((c) => learning.byHand(c, card), true), [learning, teach]);

  const thread: CaseThread = useMemo(
    () => ({
      id: current?.id ?? null,
      messages: current?.messages ?? [],
      update: (caseId: string, fn: (m: CaseMessage[]) => CaseMessage[]) => change(caseId, (c) => ({ ...c, messages: fn(c.messages) })),
    }),
    [change, current],
  );

  /** The newest copy of the current case, so a Send right after learning sends what it just learned. */
  const caseNow = useCallback(() => (currentId.current ? known.current.get(currentId.current) ?? null : null), []);

  const now = new Date();
  const row = (c: Case): CaseListRow => ({ id: c.id, label: store.label(c), when: store.when(c, now), current: c.id === current?.id, known: isKnown(c) });
  const others = recent.filter((c) => c.id !== current?.id);
  /** The sidebar list: the current case first, then the others, last used first. */
  const list = current ? [row(current), ...others.map(row)] : others.map(row);
  const pickUp = others.slice(0, PICK_UP).map(row);
  const label = current ? store.label(current) : '';
  const knownNow = current ? isKnown(current) : false;

  return { current, caseNow, label, known: knownNow, learned, list, pickUp, thread, startNew, switchTo, learnCard, learnText, setByHand };
}

export type Cases = ReturnType<typeof useCases>;
