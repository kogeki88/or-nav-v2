import { describe, expect, it } from '@jest/globals';

import { GAP, STAGGER_ROWS_MAX, WORD_MS, WORDS_MAX_MS, revealSpans, revealTime, staggerDelay, wordGap } from './motion';

describe('staggerDelay', () => {
  it('waits one gap more for each row', () => {
    expect(staggerDelay(0, GAP.matches)).toBe(0);
    expect(staggerDelay(1, GAP.matches)).toBe(GAP.matches);
    expect(staggerDelay(3, GAP.sidebar)).toBe(3 * GAP.sidebar);
  });

  it('keeps the gap between 45 and 140 ms', () => {
    expect(staggerDelay(1, 10)).toBe(45);
    expect(staggerDelay(1, 500)).toBe(140);
  });

  it('stops adding wait after the first rows, so a long list is never slow', () => {
    expect(staggerDelay(50, GAP.sidebar)).toBe(STAGGER_ROWS_MAX * GAP.sidebar);
  });
});

describe('wordGap', () => {
  it('is about 70 ms a word for a normal answer', () => {
    expect(wordGap(12)).toBe(WORD_MS);
  });

  it('gets shorter for a long answer, so the whole answer shows in a few seconds', () => {
    expect(wordGap(400) * 400).toBeLessThanOrEqual(WORDS_MAX_MS);
  });
});

describe('revealSpans', () => {
  const text = 'Hold the  bag\nuntil asked.';

  it('shows nothing before it starts and keeps every space and line break', () => {
    const spans = revealSpans(text, 0);
    expect(spans.map((s) => s.text).join('')).toBe(text);
    expect(spans.every((s) => s.alpha === 0)).toBe(true);
  });

  it('fades the words in one after another', () => {
    const gap = wordGap(5);
    const spans = revealSpans(text, gap * 1 + 1);
    const first = spans.find((s) => s.text.startsWith('Hold'));
    const last = spans[spans.length - 1];
    expect(first!.alpha).toBeGreaterThan(0);
    expect(last.alpha).toBe(0);
  });

  it('ends fully shown, as one span', () => {
    expect(revealSpans(text, revealTime(text))).toEqual([{ text, alpha: 1 }]);
  });

  it('has nothing to fade for an empty answer', () => {
    expect(revealTime('')).toBe(0);
    expect(revealSpans('', 0)).toEqual([]);
  });
});
