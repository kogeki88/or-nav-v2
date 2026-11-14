import { describe, expect, it } from '@jest/globals';

import { cornerSpot, feedbackEdges, feedbackPage, isDrag, nearestCorner, readCorner, shootWithoutButton, showFeedbackButton } from './logic';

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

describe('cornerSpot (ticket #33)', () => {
  const edges = { top: 300, bottom: 420, side: 12 };
  it('puts the top corners at the top edge it is given, left or right', () => {
    expect(cornerSpot('top-left', edges)).toEqual({ top: 300, left: 12 });
    expect(cornerSpot('top-right', edges)).toEqual({ top: 300, right: 12 });
  });
  it('puts the bottom corners at the bottom edge it is given, left or right', () => {
    expect(cornerSpot('bottom-left', edges)).toEqual({ bottom: 420, left: 12 });
    expect(cornerSpot('bottom-right', edges)).toEqual({ bottom: 420, right: 12 });
  });
});

describe('feedbackEdges (ticket #33)', () => {
  // A tall screen (ornav_pixel is about 411 x 914): room for both spots, so the #33 rule stands.
  const layout = { insetTop: 40, insetBottom: 20, topBar: 56, greeting: 170, composer: 90, pickUp: 200, gap: 12, height: 914, size: 52, strip: 55 };
  it('keeps the top corners below the top bar and the greeting', () => {
    expect(feedbackEdges(layout).top).toBe(40 + 56 + 170 + 12);
  });
  it('keeps the bottom corners above the box and the pick-up list', () => {
    expect(feedbackEdges(layout).bottom).toBe(20 + 90 + 200 + 12);
  });
});

describe('feedbackEdges on a short screen (ticket #35)', () => {
  // A 360 x 640 screen: the gap between the greeting and the pick-up list holds one button, not two.
  const short = { insetTop: 36, insetBottom: 24, topBar: 56, greeting: 170, composer: 76, pickUp: 200, gap: 12, height: 640, size: 52, strip: 55 };
  it('moves the top corners into the strip between the top bar and the greeting, a full gap below the top bar', () => {
    expect(feedbackEdges(short).top).toBe(36 + 56 + 12);
  });
  it('moves the greeting down so the button has a full gap above the headline too', () => {
    const { top, greetingShift } = feedbackEdges(short);
    const headline = 36 + 56 + 55 + greetingShift;
    expect(greetingShift).toBe(52 + 2 * 12 - 55);
    expect(headline - (top + 52)).toBe(12);
  });
  it('never moves the greeting on a tall screen', () => {
    expect(feedbackEdges({ ...short, height: 914 }).greetingShift).toBe(0);
  });
  it('never moves the greeting when the strip is already tall enough', () => {
    expect(feedbackEdges({ ...short, strip: 90 }).greetingShift).toBe(0);
  });
  it('centres the bottom corners between the moved greeting and the pick-up list, so neither is crowded', () => {
    const { bottom, greetingShift } = feedbackEdges(short);
    const greetingEnd = 36 + 56 + 170 + greetingShift;
    const pickUpTop = 640 - (24 + 76 + 200);
    const buttonTop = 640 - bottom - 52;
    expect(buttonTop - greetingEnd).toBe(pickUpTop - (buttonTop + 52));
    expect(bottom).toBeGreaterThanOrEqual(24 + 76 + 200);
  });
  it('keeps the top and bottom spots clearly apart', () => {
    const { top, bottom } = feedbackEdges(short);
    const between = 640 - bottom - 52 - (top + 52);
    expect(between).toBeGreaterThanOrEqual(12);
  });
  it('uses the short-screen rule only when both spots cannot fit apart below the greeting', () => {
    // Just tall enough: two buttons and one gap fit between the #33 edges.
    const justTall = { ...short, height: 36 + 56 + 170 + 12 + 52 + 12 + 52 + 24 + 76 + 200 + 12 };
    expect(feedbackEdges(justTall).top).toBe(36 + 56 + 170 + 12);
    expect(feedbackEdges({ ...justTall, height: justTall.height - 1 }).top).toBe(36 + 56 + 12);
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

describe('shootWithoutButton (ticket #23)', () => {
  it('hides the button before the capture, so the picture never shows it', async () => {
    const steps: string[] = [];
    const uri = await shootWithoutButton({
      hide: async () => {
        steps.push('hide');
      },
      capture: async () => {
        steps.push('capture');
        return 'file:///cache/shot.jpg';
      },
      onFault: () => undefined,
    });
    expect(steps).toEqual(['hide', 'capture']);
    expect(uri).toBe('file:///cache/shot.jpg');
  });

  it('gives no picture, and logs the error, when the capture fails (the report still goes)', async () => {
    const faults: unknown[] = [];
    const uri = await shootWithoutButton({
      hide: async () => undefined,
      capture: async () => {
        throw new Error('RNViewShot is undefined');
      },
      onFault: (e) => faults.push(e),
    });
    expect(uri).toBeNull();
    expect(faults).toEqual([new Error('RNViewShot is undefined')]);
  });

  it('gives up on a capture that never answers, so the form still opens', async () => {
    const faults: unknown[] = [];
    const uri = await shootWithoutButton({
      hide: async () => undefined,
      capture: () => new Promise<string>(() => undefined),
      onFault: (e) => faults.push(e),
      timeoutMs: 20,
    });
    expect(uri).toBeNull();
    expect(faults).toHaveLength(1);
  });
});
