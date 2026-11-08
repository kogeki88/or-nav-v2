// Remembers the admin's Regular | Admin choice on this phone. The switch itself is Segmented in MeScreen.

export type ViewName = 'regular' | 'admin';
const VIEW_KEY = 'ornav.view';

export function readSavedView(): ViewName {
  try {
    return localStorage.getItem(VIEW_KEY) === 'admin' ? 'admin' : 'regular';
  } catch {
    return 'regular';
  }
}

export function saveView(view: ViewName) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not critical: the switch just starts on Regular next time.
  }
}
