// The omnibar: a fixed "Ask OR-Nav" bar above the tab bar, on every tab, in thumb reach. Tap → chat sheet.
import { StyleSheet, Text, View } from 'react-native';

import { C, R, S } from '../theme';
import { Icon, PressScale } from '../ui/kit';

export const OMNI_BAR_SPACE = 52 + S.sm * 2;

export default function OmniBar({ onOpen, busy }: { onOpen: () => void; busy: boolean }) {
  return (
    <View style={styles.wrap}>
      <PressScale onPress={onOpen} accessibilityRole="button" accessibilityLabel="Ask OR-Nav. Opens the assistant" style={styles.bar}>
        <Icon name="zap" size={20} />
        <Text style={styles.text} numberOfLines={1}>
          {busy ? 'Thinking…' : 'Ask OR-Nav: “where’s the bovie?”'}
        </Text>
        <Icon name="arrow-up-circle" size={26} />
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, paddingVertical: S.sm, backgroundColor: C.bg },
  bar: {
    height: 52,
    borderRadius: R.control,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingHorizontal: S.lg,
  },
  text: { flex: 1, color: C.text3, fontSize: 17 },
});
