// Bottom tab bar: Library, To review, Me. Sits above the phone's own navigation bar.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, S } from '../theme';
import { Icon, IconName } from './kit';

export type TabName = 'library' | 'review' | 'me';

/** Bar height without the phone's bottom inset (tab 56 + top padding 4 + border 1). */
export const TAB_BAR_HEIGHT = 61;

const TABS: { key: TabName; label: string; icon: IconName; iconOn: IconName }[] = [
  { key: 'library', label: 'Library', icon: 'library-outline', iconOn: 'library' },
  { key: 'review', label: 'To review', icon: 'checkmark-done-circle-outline', iconOn: 'checkmark-done-circle' },
  { key: 'me', label: 'Me', icon: 'person-circle-outline', iconOn: 'person-circle' },
];

export default function TabBar({ value, onChange, badge, bottomInset }: { value: TabName; onChange: (t: TabName) => void; badge: number; bottomInset: number }) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, S.sm) }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === value;
        const count = t.key === 'review' ? badge : 0;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={count ? `${t.label}, ${count} waiting` : t.label}
            onPress={() => onChange(t.key)}
            style={styles.tab}
          >
            <View style={styles.pill}>
              {/* Mounted fresh on the active tab: changing the color of an existing rounded view
                  lost its rounded corners on Android (seen on the emulator, 2026-11-08). */}
              {on && <View style={styles.pillOn} />}
              <Icon name={on ? t.iconOn : t.icon} size={24} color={on ? C.accent : C.text3} />
              {count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, on && { color: C.accent }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line, paddingTop: S.xs },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { color: C.text3, fontSize: 13, fontWeight: '600' },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillOn: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 15, backgroundColor: C.accentSoft },
  badge: { position: 'absolute', top: -6, right: 2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.warn, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: C.bg, fontSize: 12, fontWeight: '800' },
});
