// The shell's plain rules: names, which rows show, and what Android Back closes first.
import { describe, expect, it } from '@jest/globals';

import { backStep, caseTimeName, firstName, nameSheetRows, sidebarRows } from './logic';

describe('caseTimeName', () => {
  it('names a case by the time it started, without a leading zero on the hour', () => {
    expect(caseTimeName(new Date(2026, 10, 11, 7, 42))).toBe('Case 7:42');
    expect(caseTimeName(new Date(2026, 10, 11, 7, 5))).toBe('Case 7:05');
    expect(caseTimeName(new Date(2026, 10, 11, 14, 30))).toBe('Case 2:30');
    expect(caseTimeName(new Date(2026, 10, 11, 0, 15))).toBe('Case 12:15');
  });
});

describe('firstName', () => {
  it('uses the nickname, then the first word of the full name', () => {
    expect(firstName({ nickname: 'Sam', full_name: 'Samantha Lee' })).toBe('Sam');
    expect(firstName({ nickname: '', full_name: 'Test Nurse' })).toBe('Test');
    expect(firstName({ nickname: null, full_name: '  ' })).toBe('You');
  });
});

describe('sidebarRows', () => {
  it('shows To review only when something waits', () => {
    expect(sidebarRows(0).map((r) => r.key)).toEqual(['new', 'library']);
    expect(sidebarRows(2)).toEqual([
      { key: 'new', label: 'New case' },
      { key: 'library', label: 'Library' },
      { key: 'review', label: 'To review', count: 2 },
    ]);
  });
});

describe('nameSheetRows', () => {
  it('shows Admin tools to admins only', () => {
    expect(nameSheetRows(false)).toEqual(['department', 'updates', 'signout']);
    expect(nameSheetRows(true)).toEqual(['department', 'updates', 'admin', 'signout']);
  });
});

describe('backStep', () => {
  it('closes the top layer first, and lets the app go when nothing is open', () => {
    expect(backStep({ view: 'main', sidebar: true })).toEqual({ view: 'main', sidebar: false });
    expect(backStep({ view: 'library', sidebar: false })).toEqual({ view: 'main', sidebar: false });
    expect(backStep({ view: 'admin', sidebar: false })).toEqual({ view: 'main', sidebar: false });
    expect(backStep({ view: 'main', sidebar: false })).toBeNull();
  });
});
