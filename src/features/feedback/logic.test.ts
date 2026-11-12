import { describe, expect, it } from '@jest/globals';

import { feedbackPage, isDrag, nearestCorner, readCorner, showFeedbackButton } from './logic';

describe('nearestCorner', () => {
  // A 400 x 800 screen: each drop point sits in one quarter.
  it('picks the corner of the quarter the button is dropped in', () => {
    expect(nearestCorner(50, 60, 400, 800)).toBe('top-left');
    expect(nearestCorner(350, 100, 400, 800)).toBe('top-right');
    expect(nearestCorner(30, 700, 400, 800)).toBe('bottom-left');
    expect(nearestCorner(390, 790, 400, 800)).toBe('bottom-right');
  });
  it('picks the nearest corner for points near the middle', () => {
    expect(nearestCorner(199, 399, 400, 800)).toBe('top-left');
    expect(nearestCorner(201, 401, 400, 800)).toBe('bottom-right');
  });
  it('keeps a drop off the screen on the nearest corner', () => {
    expect(nearestCorner(-20, 900, 400, 800)).toBe('bottom-left');
    expect(nearestCorner(500, -10, 400, 800)).toBe('top-right');
  });
});

describe('isDrag', () => {
  it('treats a small finger wobble as a tap', () => {
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(4, -5)).toBe(false);
  });
  it('treats a longer move as a drag', () => {
    expect(isDrag(12, 0)).toBe(true);
    expect(isDrag(0, -30)).toBe(true);
  });
});

describe('readCorner', () => {
  it('uses the saved corner', () => {
    expect(readCorner('top-left')).toBe('top-left');
    expect(readCorner('bottom-left')).toBe('bottom-left');
  });
  it('falls back to bottom right when nothing or junk is saved', () => {
    expect(readCorner(null)).toBe('bottom-right');
    expect(readCorner('middle')).toBe('bottom-right');
  });
});

describe('showFeedbackButton', () => {
  it('shows for a signed-in admin', () => {
    expect(showFeedbackButton({ id: 'u1', role: 'admin' })).toBe(true);
  });
  it('never shows for a nurse who is not an admin', () => {
    expect(showFeedbackButton({ id: 'u1', role: 'user' })).toBe(false);
    expect(showFeedbackButton({ id: 'u1', role: null })).toBe(false);
  });
  it('never shows on the sign-in page (no user)', () => {
    expect(showFeedbackButton(null)).toBe(false);
  });
});

describe('feedbackPage', () => {
  const none = { sidebar: false, case: false, name: false, department: false, item: false };
  it('names the tab when no panel is open', () => {
    expect(feedbackPage('main', none)).toBe('main');
    expect(feedbackPage('library', none)).toBe('library');
  });
  it('adds the open panel to the tab', () => {
    expect(feedbackPage('main', { ...none, case: true })).toBe('main / case panel');
    expect(feedbackPage('main', { ...none, sidebar: true })).toBe('main / sidebar');
    expect(feedbackPage('main', { ...none, item: true })).toBe('main / library sheet');
  });
});
