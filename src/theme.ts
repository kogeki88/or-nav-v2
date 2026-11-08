// OR-Nav design tokens. Mirrors design/DESIGN.md: change values there and here together.
import { StyleSheet } from 'react-native';

export const C = {
  bg: '#0B0F19',
  surface: '#111827',
  raised: '#172033',
  line: '#1F2937',
  accent: '#38BDF8',
  accentSoft: '#38BDF81F',
  text: '#F8FAFC',
  text2: '#94A3B8',
  text3: '#64748B',
  ok: '#4ADE80',
  okSoft: '#4ADE8024',
  warn: '#FBBF24',
  warnSoft: '#FBBF2426',
  danger: '#F87171',
  dangerSoft: '#F8717124',
  scrim: '#0B0F1999',
  handle: '#334155',
  // Older names, kept so earlier screens keep working.
  card: '#111827',
  muted: '#94A3B8',
};

/** Spacing scale: 4, 8, 12, 16, 24, 32. */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Corner radius. */
export const R = { control: 12, card: 16, sheet: 28 };

/** Type scale (system font). */
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
  primaryText: { color: C.bg, fontSize: 18, fontWeight: '700' },
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
  card: { backgroundColor: C.surface, borderRadius: R.card, paddingHorizontal: 20, paddingVertical: 8 },
  group: { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, gap: 12 },
  rowLabel: { color: C.text2, fontSize: 17 },
  rowValue: { color: C.text, fontSize: 17, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: R.control,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
