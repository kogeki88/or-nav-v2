// OR-Nav design tokens. Mirrors design/DESIGN.md: change values there and here together.
import { StyleSheet } from 'react-native';

// Version 3 tokens (2026-11-10): near-black, plain rows, one quiet green for the main action.
const bg = '#121314';
const fill = '#1C1D20';
const fill2 = '#26272B';
const hairline = '#2A2B2F';
const accent = '#7DD3B8';
const warn = '#E9B65A';
const danger = '#F08A80';

export const C = {
  bg,
  fill,
  fill2,
  hairline,
  text: '#ECECEE',
  text2: '#A1A2A8',
  text3: '#6E6F75',
  accent,
  onAccent: '#0E2A22',
  warn,
  danger,
  // Tints of the colors above (the last two hex digits are the opacity).
  accentSoft: `${accent}1F`,
  warnSoft: `${warn}26`,
  dangerSoft: `${danger}24`,
  scrim: `${bg}99`,
  // Older names, kept so earlier screens keep working. They point at the version 3 colors.
  surface: fill,
  raised: fill2,
  line: hairline,
  handle: fill2,
  ok: accent,
  okSoft: `${accent}1F`,
  card: fill,
  muted: '#A1A2A8',
};

/** Spacing scale: 4, 8, 12, 16, 24, 32. */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Corner radius. */
export const R = { control: 12, card: 16, sheet: 28 };

/** Type scale (system font until the Manrope files are bundled). */
export const T = StyleSheet.create({
  largeTitle: { color: C.text, fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { color: C.text, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  headline: { color: C.text, fontSize: 19, lineHeight: 24, fontWeight: '600' },
  body: { color: C.text, fontSize: 17, lineHeight: 24 },
  bodyStrong: { color: C.text, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  callout: { color: C.text2, fontSize: 16, lineHeight: 22 },
  caption: { color: C.text2, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
});

export const ui = StyleSheet.create({
  primary: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: S.sm,
    paddingHorizontal: S.lg,
  },
  primaryText: { color: C.onAccent, fontSize: 18, fontWeight: '700' },
  secondary: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: S.sm,
    paddingHorizontal: S.lg,
  },
  secondaryText: { color: C.accent, fontSize: 18, fontWeight: '600' },
  dim: { opacity: 0.6 },
  card: { backgroundColor: C.fill, borderRadius: R.card, paddingHorizontal: 20, paddingVertical: 8 },
  // Lists are plain rows: no card, no border (version 3).
  group: {},
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, gap: 12 },
  rowLabel: { color: C.text2, fontSize: 17 },
  rowValue: { color: C.text, fontSize: 17, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  // Icon tiles keep their size so rows line up, but lose the tinted square.
  iconTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
