// The small sheet a tap on the case label opens: the department's preference cards, a search line
// and "Clear". Picking a card sets the case by hand (learning then leaves it alone).
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Card } from '../../contracts/library';
import type { LibrarySearch } from '../../contracts/search';
import { C, S, T } from '../../theme';
import BottomSheet from '../../ui/BottomSheet';
import { Button, Group, Icon, IconButton, ListRow, SearchField } from '../../ui/kit';

type Props = {
  open: boolean;
  onClose: () => void;
  /** The department's preference cards. */
  cards: Card[];
  /** The same cards, ready to search. */
  search: LibrarySearch;
  currentCardId: string | null;
  /** The case knows its surgeon or procedure (then "Clear" is offered). */
  known: boolean;
  onPick: (card: Card) => void;
  onClear: () => void;
};

export default function CaseSheet({ open, onClose, cards, search, currentCardId, known, onPick, onClear }: Props) {
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);

  const shown = useMemo(() => {
    if (q.trim() === '') return [...cards].sort((a, b) => a.procedure.localeCompare(b.procedure) || a.surgeon.localeCompare(b.surgeon));
    const ids = new Set(cards.map((c) => c.id));
    return search
      .search(q)
      .cards.map((r) => r.record)
      .filter((c) => ids.has(c.id));
  }, [cards, q, search]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Change the case"
      header={
        <View style={{ gap: S.md }}>
          <View style={styles.titleRow}>
            <Text style={[T.headline, { flex: 1 }]} accessibilityRole="header">
              Which case?
            </Text>
            <IconButton name="x" label="Close" onPress={onClose} />
          </View>
          <SearchField value={q} onChange={setQ} placeholder="Surgeon or procedure" />
        </View>
      }
      footer={known ? <Button kind="secondary" label="Clear" icon="x-circle" onPress={onClear} /> : undefined}
    >
      {shown.length === 0 ? (
        <Text style={[T.callout, styles.none]}>{cards.length === 0 ? 'This department has no preference cards yet.' : 'No card matches.'}</Text>
      ) : (
        <Group>
          {shown.map((c, i) => {
            const on = c.id === currentCardId;
            return (
              <ListRow
                key={c.id}
                first={i === 0}
                title={c.procedure}
                subtitle={c.surgeon}
                onPress={() => onPick(c)}
                label={`${c.procedure}, ${c.surgeon}${on ? ', current case' : ''}`}
                right={on ? <Icon name="check" color={C.accent} size={22} /> : undefined}
              />
            );
          })}
        </Group>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  none: { textAlign: 'center', paddingVertical: S.lg },
});
