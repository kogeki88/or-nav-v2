import { describe, expect, it } from '@jest/globals';

import { feedbackPage, showFeedbackButton } from './logic';

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
