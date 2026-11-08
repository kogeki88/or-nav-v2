import { Text, View } from 'react-native';

import { ui } from '../theme';

export default function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={ui.row}>
      <Text style={ui.rowLabel}>{label}</Text>
      <Text style={[ui.rowValue, color ? { color } : null]} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}
