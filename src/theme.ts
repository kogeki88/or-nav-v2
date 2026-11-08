// OR Dark Mode palette (Master Plan, section 3) and shared building blocks.
import { StyleSheet } from 'react-native';

export const C = {
  bg: '#0B0F19',
  card: '#111827',
  accent: '#38BDF8',
  text: '#F8FAFC',
  muted: '#94A3B8',
  danger: '#F87171',
  ok: '#4ADE80',
};

export const ui = StyleSheet.create({
  primary: {
    minHeight: 60,
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: C.bg, fontSize: 19, fontWeight: '700' },
  secondary: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: C.accent, fontSize: 18, fontWeight: '600' },
  dim: { opacity: 0.6 },
  card: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, gap: 12 },
  rowLabel: { color: C.muted, fontSize: 17 },
  rowValue: { color: C.text, fontSize: 17, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
