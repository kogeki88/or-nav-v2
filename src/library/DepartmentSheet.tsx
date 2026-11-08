// Switch between your departments, or join another one (pick and go).
import { useState } from 'react';
import { Text, View } from 'react-native';

import BottomSheet from '../ui/BottomSheet';
import { Banner, Button, Group, Icon, IconButton, IconTile, ListRow, SectionLabel } from '../ui/kit';
import { C, S, T } from '../theme';
import type { Library } from './useLibrary';

export default function DepartmentSheet({ lib, open, onClose, jobRole }: { lib: Library; open: boolean; onClose: () => void; jobRole: string | null }) {
  const [busyId, setBusyId] = useState('');
  const [problem, setProblem] = useState('');
  const mineIds = new Set(lib.mine.map((m) => m.department.id));

  const join = async (id: string) => {
    setBusyId(id);
    setProblem('');
    try {
      await lib.join(id, jobRole);
      onClose();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId('');
    }
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <IconTile name="business-outline" size={48} />
      <View style={{ flex: 1 }}>
        <Text style={T.title} accessibilityRole="header">
          Departments
        </Text>
        <Text style={T.callout}>You see only the departments you join.</Text>
      </View>
      <IconButton name="close" label="Close" onPress={onClose} />
    </View>
  );

  return (
    <BottomSheet open={open} onClose={onClose} header={header} label="Departments">
      {problem !== '' && <Banner text={problem} tone="danger" icon="alert-circle-outline" />}

      {lib.mine.length > 0 && (
        <View>
          <SectionLabel text="Your departments" />
          <Group>
            {lib.mine.map(({ department, hospital }, i) => {
              const on = department.id === lib.deptId;
              return (
                <ListRow
                  key={department.id}
                  first={i === 0}
                  icon="medkit-outline"
                  title={department.name}
                  subtitle={hospital?.name}
                  label={`${department.name}, ${hospital?.name ?? ''}${on ? ', selected' : ''}`}
                  right={on ? <Icon name="checkmark-circle" color={C.accent} size={24} /> : <View style={{ width: 24 }} />}
                  onPress={() => {
                    lib.setDept(department.id);
                    onClose();
                  }}
                />
              );
            })}
          </Group>
        </View>
      )}

      {lib.data.hospitals.map((h) => {
        const others = lib.data.departments.filter((d) => d.hospital_id === h.id && !mineIds.has(d.id));
        if (others.length === 0) return null;
        return (
          <View key={h.id}>
            <SectionLabel text={`Join · ${h.name}`} right={h.city ?? undefined} />
            <Group>
              {others.map((d, i) => (
                <ListRow
                  key={d.id}
                  first={i === 0}
                  icon="add-circle-outline"
                  title={d.name}
                  subtitle={h.name}
                  right={<Button label="Join" kind="ghost" busy={busyId === d.id} onPress={() => join(d.id)} />}
                />
              ))}
            </Group>
          </View>
        );
      })}

      {lib.data.hospitals.length === 0 && !lib.loading && <Text style={T.callout}>No hospitals yet. An admin adds them in Supabase.</Text>}
    </BottomSheet>
  );
}
