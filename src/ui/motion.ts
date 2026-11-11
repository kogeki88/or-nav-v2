// One shared set of motion rules for the whole app (ticket #17). Every moving part reads its
// timing, ease and spring from here, and every one obeys the phone's "Remove animations" setting:
// with it on, things only fade (no slide, no pulse, no line drawing, no breathing).
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

/** Ease out, from the design mockup: cubic-bezier(.2,.8,.2,1). */
export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Rise in: fade from 0 and move this far into place. */
export const RISE_MS = 550;
export const RISE_PX = 10;
/** Sidebar rows slide in from the left instead. */
export const SLIDE_PX = 12;
/** Gap between rows that rise one after another (ms). */
export const GAP = { sidebar: 45, matches: 80, cases: 90, greeting: 140 } as const;
const GAP_MIN = 45;
const GAP_MAX = 140;
/** After this many rows, later rows rise together, so a long list never waits. */
export const STAGGER_ROWS_MAX = 8;

/** The one spring for the sidebar and every bottom sheet. */
export const SPRING = { damping: 26, stiffness: 240, mass: 0.9 } as const;
/** How far Send and Open shrink on a press ("pop"). */
export const POP_SCALE = 0.9;
/** Plain fades (reduce motion, closing a sheet). */
export const FADE_MS = 220;

/** AI answers fade in word by word. */
export const WORD_MS = 70;
export const WORD_FADE_MS = 350;
/** A long answer speeds up, so the whole answer is in view within this time. */
export const WORDS_MAX_MS = 2800;

/** Wait before row `index` starts to rise. */
export function staggerDelay(index: number, gap: number): number {
  const g = Math.min(GAP_MAX, Math.max(GAP_MIN, gap));
  return Math.min(Math.max(0, index), STAGGER_ROWS_MAX) * g;
}

/** Time between two words for an answer of `count` words. */
export function wordGap(count: number): number {
  if (count <= 1) return WORD_MS;
  return Math.min(WORD_MS, (WORDS_MAX_MS - WORD_FADE_MS) / (count - 1));
}

/** Words with the spaces after them, so joining them gives the text back exactly. */
function tokens(text: string): string[] {
  return text.match(/^\s+|\S+\s*/g) ?? [];
}

function wordCount(parts: string[]): number {
  return parts.filter((p) => /\S/.test(p)).length;
}

/** Time until the last word is fully shown. */
export function revealTime(text: string): number {
  const n = wordCount(tokens(text));
  if (n === 0) return 0;
  return (n - 1) * wordGap(n) + WORD_FADE_MS;
}

export type Span = { text: string; alpha: number };

/** The answer as spans of the same see-through amount, `elapsed` ms after it started. */
export function revealSpans(text: string, elapsed: number): Span[] {
  const parts = tokens(text);
  const gap = wordGap(wordCount(parts));
  const spans: Span[] = [];
  let word = 0;
  for (const p of parts) {
    const i = /\S/.test(p) ? word++ : 0;
    const raw = (elapsed - i * gap) / WORD_FADE_MS;
    // Steps of 0.1 keep the number of spans small.
    const alpha = Math.round(Math.min(1, Math.max(0, raw)) * 10) / 10;
    const last = spans[spans.length - 1];
    if (last && last.alpha === alpha) last.text += p;
    else spans.push({ text: p, alpha });
  }
  return spans;
}

/** A #RRGGBB color with see-through amount `alpha` (0 to 1), as #RRGGBBAA. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return hex.slice(0, 7) + a.toString(16).padStart(2, '0');
}

// One listener for the whole app; every component reads the same answer.
let reduceNow = false;
let listening = false;
const subscribers = new Set<(v: boolean) => void>();

function listen() {
  if (listening) return;
  listening = true;
  const set = (v: boolean) => {
    reduceNow = v;
    subscribers.forEach((fn) => fn(v));
  };
  AccessibilityInfo.isReduceMotionEnabled().then(set, () => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
}

/** True when the phone asks for less motion ("Remove animations"). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(reduceNow);
  useEffect(() => {
    listen();
    subscribers.add(setReduce);
    setReduce(reduceNow);
    return () => {
      subscribers.delete(setReduce);
    };
  }, []);
  return reduce;
}
