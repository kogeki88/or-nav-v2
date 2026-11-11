import { describe, expect, it } from '@jest/globals';
import { MAX_FEEDBACK_MESSAGE, canSendFeedback, pageName, showFeedbackButton } from './logic';

describe('showFeedbackButton', () => {
  it('shows only for a signed-in admin outside demo mode', () => {
    expect(showFeedbackButton({ isAdmin: true, signedIn: true, demo: false })).toBe(true);
  });

  it('never shows for a nurse, a signed-out user, or demo mode', () => {
    expect(showFeedbackButton({ isAdmin: false, signedIn: true, demo: false })).toBe(false);
    expect(showFeedbackButton({ isAdmin: true, signedIn: false, demo: false })).toBe(false);
    expect(showFeedbackButton({ isAdmin: true, signedIn: true, demo: true })).toBe(false);
  });
});

describe('canSendFeedback', () => {
  it('needs at least one character after trimming', () => {
    expect(canSendFeedback('')).toBe(false);
    expect(canSendFeedback('   \n ')).toBe(false);
    expect(canSendFeedback(' ok ')).toBe(true);
  });

  it('stops at the message limit', () => {
    expect(canSendFeedback('a'.repeat(MAX_FEEDBACK_MESSAGE))).toBe(true);
    expect(canSendFeedback('a'.repeat(MAX_FEEDBACK_MESSAGE + 1))).toBe(false);
  });
});

describe('pageName', () => {
  const base = { view: 'main' as const, sidebar: false, caseOpen: false, nameOpen: false, deptOpen: false, libraryOpen: false };

  it('names the plain main screen', () => {
    expect(pageName(base)).toBe('Main screen');
  });

  it('adds each open panel after the screen, in a fixed order', () => {
    expect(pageName({ ...base, caseOpen: true, libraryOpen: true })).toBe('Main screen + case panel + library item');
  });

  it('names a full-screen view and the sidebar', () => {
    expect(pageName({ ...base, view: 'library', sidebar: true })).toBe('Library + sidebar');
    expect(pageName({ ...base, view: 'admin' })).toBe('Admin tools');
  });
});
