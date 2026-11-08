// Regular | Admin switch, shown only to admin accounts. Remembers the choice on this phone.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from '../theme';

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
    // Not critical: the toggle just starts on Regular next time.
  }
}

export default function ViewToggle({ value, onChange }: { value: ViewName; onChange: (v: ViewName) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {(['regular', 'admin'] as const).map((name) => {
        const selected = value === name;
        return (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(name)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {name === 'regular' ? 'Regular view' : 'Admin view'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: C.accent },
  label: { color: C.muted, fontSize: 17, fontWeight: '600' },
  labelSelected: { color: C.bg },
});
