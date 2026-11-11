// The name sheet: opens from the first name at the bottom of the sidebar.
// Department, Check for updates, Admin tools (admins only) and Sign out.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F, S, T } from '../../theme';
import BottomSheet from '../../ui/BottomSheet';
import { Avatar, Icon, IconName, ProgressBar } from '../../ui/kit';
import type { UpdateState } from '../../views/UpdatePanel';
import { NameSheetRow, nameSheetRows } from './logic';

type Props = {
  open: boolean;
  onClose: () => void;
  person: { name: string; fullName: string; emoji: string | null; role: string };
  isAdmin: boolean;
  department: string;
  version: string;
  update: UpdateState;
  onDepartment: () => void;
  onAdmin: () => void;
  onSignOut: () => void;
};

export default function NameSheet({ open, onClose, person, isAdmin, department, version, update, onDepartment, onAdmin, onSignOut }: Props) {
  const busy = update.phase !== 'idle';
  const updateValue = update.phase === 'checking' ? 'Checking…' : update.phase === 'downloading' ? `${Math.round(update.progress * 100)}%` : version;

  const ROWS: Record<NameSheetRow, { icon: IconName; title: string; value?: string; onPress: () => void; danger?: boolean; chevron?: boolean }> = {
    department: { icon: 'map-pin', title: 'Department', value: department, onPress: onDepartment },
    updates: { icon: 'download', title: 'Check for updates', value: updateValue, onPress: () => !busy && update.run() },
    admin: { icon: 'tool', title: 'Admin tools', onPress: onAdmin, chevron: true },
    signout: { icon: 'log-out', title: 'Sign out', onPress: onSignOut, danger: true },
  };

  const header = (
    <View style={styles.who} accessible accessibilityLabel={`${person.name}, ${person.role}`}>
      <Avatar emoji={person.emoji} name={person.fullName} size={52} />
      <View style={{ flex: 1 }}>
        <Text style={T.headline} numberOfLines={1}>
          {person.name}
        </Text>
        <Text style={[T.callout, { color: C.text3 }]} numberOfLines={1}>
          {person.role}
        </Text>
      </View>
    </View>
  );

  return (
    <BottomSheet open={open} onClose={onClose} header={header} label="Your settings">
      <View>
        {nameSheetRows(isAdmin).map((key, i) => {
          const r = ROWS[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={r.value ? `${r.title}: ${r.value}` : r.title}
              onPress={r.onPress}
              style={({ pressed }) => [styles.row, i > 0 && styles.line, pressed && { backgroundColor: C.fill }]}
            >
              <Icon name={r.icon} size={20} color={r.danger ? C.danger : C.text2} />
              <Text style={[styles.title, r.danger && { color: C.danger }]}>{r.title}</Text>
              {r.value ? (
                <Text style={styles.value} numberOfLines={1}>
                  {r.value}
                </Text>
              ) : null}
              {r.chevron && <Icon name="chevron-right" size={20} color={C.text3} />}
            </Pressable>
          );
        })}
      </View>
      {update.phase === 'downloading' && <ProgressBar value={update.progress} />}
      {update.status !== '' && (
        <Text style={[T.callout, update.isError && { color: C.danger }]} accessibilityLiveRegion="polite">
          {update.status}
        </Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: S.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 56 },
  line: { borderTopWidth: 1, borderTopColor: C.line },
  title: { fontFamily: F, color: C.text, fontSize: 17, fontWeight: '600', flex: 1 },
  value: { fontFamily: F, color: C.text2, fontSize: 15, flexShrink: 1, maxWidth: '50%', textAlign: 'right' },
});
