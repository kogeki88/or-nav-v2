// What the preview sheet shows: an item, a preference card, the edit form, or "sent for review".
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import BottomSheet from '../ui/BottomSheet';
import { Badge, Banner, Button, Field, Group, Icon, IconButton, IconTile, ListRow, SectionLabel } from '../ui/kit';
import { C, R, S, T } from '../theme';
import { FIELDS, cardLines, cardSubtitle, cardsUsing, changedFields, departmentLabel, itemLocation, missingRequired, pendingFor, show } from './logic';
import type { Library } from './useLibrary';
import type { Card, Item } from './types';

export type Selection =
  | { type: 'item'; id: string }
  | { type: 'card'; id: string }
  | { type: 'new' }
  | { type: 'new-item' }
  | { type: 'new-card' };

type Mode = 'view' | 'edit' | 'sent';

export default function LibrarySheet({ lib, selection, onSelect, onClose }: { lib: Library; selection: Selection | null; onSelect: (s: Selection) => void; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('view');
  const [shown, setShown] = useState<Selection | null>(selection);

  // Keep showing the last selection while the sheet slides away.
  useEffect(() => {
    if (selection) {
      setShown(selection);
      setMode(selection.type === 'new-item' || selection.type === 'new-card' ? 'edit' : 'view');
    }
  }, [selection]);

  const item = shown?.type === 'item' ? lib.data.items.find((i) => i.id === shown.id) : undefined;
  const card = shown?.type === 'card' ? lib.data.cards.find((c) => c.id === shown.id) : undefined;
  const target: 'item' | 'card' = shown?.type === 'card' || shown?.type === 'new-card' ? 'card' : 'item';
  const isNew = shown?.type === 'new-item' || shown?.type === 'new-card';
  const row = (item ?? card) as (Item | Card) | undefined;
  const dept = row?.department_id ?? lib.deptId;
  const where = departmentLabel(lib.data, dept ?? null).split(' · ').pop() ?? 'your department';

  const [form, setForm] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'edit') return;
    const f: Record<string, string> = {};
    for (const field of FIELDS[target]) {
      const v = (row as Record<string, unknown> | undefined)?.[field.key];
      f[field.key] = Array.isArray(v) ? v.join(', ') : ((v as string | null) ?? '');
    }
    setForm(f);
    setProblem('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, shown]);

  const changes = useMemo(() => (mode === 'edit' ? changedFields(target, form, (row as Record<string, unknown>) ?? null) : {}), [mode, target, form, row]);

  const send = async () => {
    const missing = missingRequired(target, form);
    if (missing) return setProblem(missing);
    if (Object.keys(changes).length === 0) return setProblem('Change at least one field first.');
    if (!dept) return setProblem('Choose a department first.');
    setBusy(true);
    try {
      await lib.propose({
        department_id: dept,
        kind: isNew ? 'add' : 'edit',
        target,
        target_id: isNew ? null : row!.id,
        data: changes,
        base_version: isNew ? null : row!.version,
      });
      setMode('sent');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const open = selection !== null;
  const pending = row ? pendingFor(lib.data.requests, target, row.id) : [];

  // ---------- Header ----------
  let header = null;
  if (mode === 'sent') {
    header = <SheetTitle icon="checkmark-circle" iconColor={C.ok} iconBg={C.okSoft} title="Sent for review" subtitle={where} onClose={onClose} />;
  } else if (shown?.type === 'new') {
    header = <SheetTitle icon="add" title="Suggest something new" subtitle={where} onClose={onClose} />;
  } else if (mode === 'edit') {
    header = (
      <SheetTitle
        icon="create-outline"
        title={isNew ? (target === 'item' ? 'New item' : 'New preference card') : 'Suggest an edit'}
        subtitle={isNew ? where : item?.name ?? (card ? `${card.procedure} · ${card.surgeon}` : '')}
        onClose={onClose}
      />
    );
  } else if (item) {
    header = <SheetTitle icon="cube-outline" title={item.name} subtitle={[item.category, `version ${item.version}`].filter(Boolean).join(' · ')} onClose={onClose} />;
  } else if (card) {
    header = <SheetTitle icon="clipboard-outline" title={card.procedure} subtitle={cardSubtitle(card)} onClose={onClose} />;
  } else {
    header = <SheetTitle icon="help-circle-outline" title="Not found" subtitle="It may have been removed." onClose={onClose} />;
  }

  // ---------- Footer (the one main action) ----------
  let footer = null;
  if (mode === 'sent') {
    footer = <Button label="Done" onPress={onClose} />;
  } else if (mode === 'edit') {
    footer = (
      <>
        <Button label="Send for review" icon="paper-plane-outline" onPress={send} busy={busy} />
        <Button label="Cancel" kind="ghost" onPress={() => (isNew ? onClose() : setMode('view'))} />
      </>
    );
  } else if (row) {
    footer = (
      <>
        <Button label="Suggest an edit" icon="create-outline" onPress={() => setMode('edit')} />
        <Text style={styles.footHint}>A colleague in {where} reviews it before it changes.</Text>
      </>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} header={header} footer={footer} label="Details">
      {mode === 'sent' && (
        <View style={{ gap: S.md }}>
          <Text style={T.body}>Your change is waiting for a colleague in {where}. It shows as Pending until someone approves it.</Text>
          <Text style={T.callout}>You can follow it in the To review tab, under Your suggestions.</Text>
        </View>
      )}

      {mode === 'view' && shown?.type === 'new' && (
        <View style={{ gap: S.md }}>
          <Choice icon="cube-outline" title="Item" body="A supply or instrument and where it lives." onPress={() => onSelect({ type: 'new-item' })} />
          <Choice icon="clipboard-outline" title="Preference card" body="A surgeon's setup for one procedure." onPress={() => onSelect({ type: 'new-card' })} />
        </View>
      )}

      {mode === 'view' && pending.length > 0 && <Banner text={`${pending.length === 1 ? 'A change is' : `${pending.length} changes are`} waiting for review.`} icon="time-outline" />}

      {mode === 'view' && item && <ItemBody lib={lib} item={item} onSelect={onSelect} />}
      {mode === 'view' && card && <CardBody lib={lib} card={card} onSelect={onSelect} />}

      {mode === 'edit' && (
        <View style={{ gap: S.lg }}>
          {FIELDS[target].map((f) => (
            <Field
              key={f.key}
              label={f.required ? f.label : `${f.label} (optional)`}
              hint={f.list ? 'Separate names with commas.' : undefined}
              value={form[f.key] ?? ''}
              onChange={(v) => {
                setForm((x) => ({ ...x, [f.key]: v }));
                setProblem('');
              }}
              multiline={f.multiline}
              changed={!isNew && f.key in changes}
            />
          ))}
          {problem !== '' && <Banner text={problem} tone="danger" icon="alert-circle-outline" />}
        </View>
      )}
    </BottomSheet>
  );
}

function SheetTitle({ icon, title, subtitle, onClose, iconColor, iconBg }: { icon: Parameters<typeof IconTile>[0]['name']; title: string; subtitle?: string; onClose: () => void; iconColor?: string; iconBg?: string }) {
  return (
    <View style={styles.title}>
      <IconTile name={icon} size={48} color={iconColor} bg={iconBg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={T.title} numberOfLines={2} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={T.callout} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <IconButton name="close" label="Close" onPress={onClose} />
    </View>
  );
}

function Choice({ icon, title, body, onPress }: { icon: Parameters<typeof IconTile>[0]['name']; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, pressed && { borderColor: C.accent }]}>
      <IconTile name={icon} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={T.headline}>{title}</Text>
        <Text style={T.callout}>{body}</Text>
      </View>
      <Icon name="chevron-forward" color={C.text3} />
    </Pressable>
  );
}

function Detail({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.kv, !first && styles.kvLine]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[T.callout, { width: 112 }]}>{label}</Text>
      <Text style={[T.body, { flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function ItemBody({ lib, item, onSelect }: { lib: Library; item: Item; onSelect: (s: Selection) => void }) {
  const cards = cardsUsing(lib.data, item.id);
  return (
    <>
      <View style={styles.hero}>
        <Icon name="location-outline" color={C.accent} size={22} />
        <View style={{ flex: 1 }}>
          <Text style={T.caption}>Where to find it</Text>
          <Text style={T.headline}>{itemLocation(item)}</Text>
        </View>
      </View>
      <Group style={{ paddingHorizontal: S.lg }}>
        <Detail first label="Also called" value={show(item.synonyms)} />
        <Detail label="Category" value={show(item.category)} />
        <Detail label="Notes" value={show(item.notes)} />
      </Group>
      <SectionLabel text="On preference cards" right={String(cards.length)} />
      {cards.length === 0 ? (
        <Text style={T.callout}>Not on any card yet.</Text>
      ) : (
        <Group>
          {cards.map((c, i) => (
            <ListRow key={c.id} first={i === 0} icon="clipboard-outline" title={c.procedure} subtitle={cardSubtitle(c)} onPress={() => onSelect({ type: 'card', id: c.id })} />
          ))}
        </Group>
      )}
    </>
  );
}

function CardBody({ lib, card, onSelect }: { lib: Library; card: Card; onSelect: (s: Selection) => void }) {
  const groups = cardLines(lib.data, card.id);
  const total = groups.reduce((n, g) => n + g.lines.length, 0);
  return (
    <>
      {card.notes ? (
        <View style={styles.hero}>
          <Icon name="chatbubble-ellipses-outline" color={C.accent} size={22} />
          <Text style={[T.body, { flex: 1 }]}>{card.notes}</Text>
        </View>
      ) : null}
      {total === 0 && <Text style={T.callout}>No items on this card yet.</Text>}
      {groups.map((g) => (
        <View key={g.phase}>
          <SectionLabel text={g.phase} right={String(g.lines.length)} />
          <Group>
            {g.lines.map(({ line, item }, i) => (
              <ListRow
                key={line.id}
                first={i === 0}
                title={`${line.quantity} × ${item?.name ?? 'Unknown item'}`}
                subtitle={item ? itemLocation(item) : undefined}
                right={line.open_or_hold === 'hold' ? <Badge label="Hold" tone="warn" /> : <Badge label="Open" tone="ok" />}
                onPress={item ? () => onSelect({ type: 'item', id: item.id }) : undefined}
              />
            ))}
          </Group>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  footHint: { ...T.callout, fontSize: 14, color: C.text3, textAlign: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.lg, borderRadius: R.card, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, minHeight: 80 },
  kv: { flexDirection: 'row', gap: S.md, paddingVertical: S.md, alignItems: 'flex-start' },
  kvLine: { borderTopWidth: 1, borderTopColor: C.line },
  hero: { flexDirection: 'row', gap: S.md, alignItems: 'center', padding: S.lg, borderRadius: R.card, backgroundColor: C.accentSoft },
});
