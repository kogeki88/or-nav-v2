// The omnibar chat: messages, result rows, drafts to send for review, and the input box.
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { itemIcon } from '../features/library/icons';
import type { Selection } from '../features/library/LibrarySheet';
import { cardSubtitle, departmentLabel, itemLocation, requestTitle, reviewRows } from '../features/library/logic';
import type { ChangeRequest } from '../contracts/library';
import type { Library } from '../features/library/useLibrary';
import { C, R, S, T } from '../theme';
import BottomSheet from '../ui/BottomSheet';
import { Badge, Button, Group, Icon, IconButton, IconTile, ListRow, PressScale } from '../ui/kit';
import type { TabName } from '../ui/TabBar';
import type { OmniAction } from '../../supabase/functions/omnibar/schema';
import type { OmniMessage, Omnibar } from './useOmnibar';
import { Draft, draftToChange } from './validate';

const EXAMPLES = ['Where is the bovie?', "What's on Avery's lap chole for closure?", 'Add 2 x 0 vicryl to the lap chole closure'];
const TAB_LABEL: Record<TabName, string> = { library: 'Library', review: 'To review', me: 'Me' };

type Props = {
  open: boolean;
  onClose: () => void;
  omni: Omnibar;
  lib: Library;
  onOpenSelection: (s: Selection) => void;
  onGoTo: (tab: TabName) => void;
};

export default function OmniSheet({ open, onClose, omni, lib, onOpenSelection, onGoTo }: Props) {
  const [text, setText] = useState('');

  const submit = async (value = text) => {
    const sent = await omni.send(value);
    if (sent) setText('');
  };

  const header = (
    <View style={styles.header}>
      <IconTile name="zap" />
      <View style={{ flex: 1 }}>
        <Text style={T.headline}>Ask OR-Nav</Text>
        <Text style={T.callout} numberOfLines={1}>
          {departmentLabel(lib.data, lib.deptId)}
        </Text>
      </View>
      {omni.messages.length > 0 && <IconButton name="trash-2" label="Clear the chat" onPress={omni.clear} />}
      <IconButton name="x" label="Close" onPress={onClose} />
    </View>
  );

  const footer = (
    <>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask, or ask for a change…"
          placeholderTextColor={C.text3}
          style={styles.input}
          multiline
          maxLength={1000}
          accessibilityLabel="Message to the assistant"
          editable={!omni.busy}
        />
        {omni.busy ? (
          <View style={styles.send}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : (
          <PressScale onPress={() => submit()} disabled={text.trim() === ''} accessibilityLabel="Send" style={[styles.send, text.trim() === '' && { opacity: 0.4 }]}>
            <Icon name="arrow-up-circle" size={40} />
          </PressScale>
        )}
      </View>
      <View style={styles.privacy}>
        <Icon name="shield" size={16} color={C.text3} />
        <Text style={styles.privacyText}>No patient information. Changes go to a colleague for review.</Text>
      </View>
    </>
  );

  return (
    <BottomSheet open={open} onClose={onClose} header={header} footer={footer} label="Ask OR-Nav" stickToEnd>
      {omni.messages.length === 0 && (
        <View style={{ gap: S.sm }}>
          <Text style={T.callout}>Ask in your own words. OR shorthand is fine. Try:</Text>
          {EXAMPLES.map((e) => (
            <ListRow key={e} first icon="message-circle" title={e} onPress={() => submit(e)} />
          ))}
        </View>
      )}
      {omni.messages.map((m) => (
        <Message key={m.id} m={m} lib={lib} omni={omni} onOpenSelection={onOpenSelection} onGoTo={onGoTo} />
      ))}
    </BottomSheet>
  );
}

function Message({ m, lib, omni, onOpenSelection, onGoTo }: { m: OmniMessage; lib: Library; omni: Omnibar; onOpenSelection: (s: Selection) => void; onGoTo: (t: TabName) => void }) {
  if (m.role === 'user') {
    return (
      <View style={styles.userWrap}>
        <View style={styles.user}>
          <Text style={T.body}>{m.text}</Text>
        </View>
        {m.note ? <Text style={styles.note}>{m.note}</Text> : null}
      </View>
    );
  }
  const color = m.tone === 'danger' ? C.danger : m.tone === 'warn' ? C.warn : C.text;
  return (
    <View style={{ gap: S.sm }}>
      <View style={[styles.assistant, m.tone === 'danger' && { borderColor: C.danger }]}>
        {m.note ? <Badge label={m.note} tone={m.tone === 'danger' ? 'neutral' : 'warn'} /> : null}
        {m.engine === 'backup' ? <Badge label="Backup AI" tone="neutral" /> : null}
        <Text style={[T.body, { color }]}>{m.text}</Text>
      </View>
      {(m.actions ?? []).map((a, i) => (
        <ActionView key={i} a={a} index={i} m={m} lib={lib} omni={omni} onOpenSelection={onOpenSelection} onGoTo={onGoTo} />
      ))}
    </View>
  );
}

function ActionView({
  a,
  index,
  m,
  lib,
  omni,
  onOpenSelection,
  onGoTo,
}: {
  a: OmniAction;
  index: number;
  m: OmniMessage;
  lib: Library;
  omni: Omnibar;
  onOpenSelection: (s: Selection) => void;
  onGoTo: (t: TabName) => void;
}) {
  const item = (id: string) => lib.data.items.find((x) => x.id === id);
  const card = (id: string) => lib.data.cards.find((x) => x.id === id);

  if (a.type === 'open_item' || a.type === 'open_card' || a.type === 'show_results') {
    const itemIds = a.type === 'open_item' ? [a.item_id] : a.type === 'show_results' ? a.item_ids : [];
    const cardIds = a.type === 'open_card' ? [a.card_id] : a.type === 'show_results' ? a.card_ids : [];
    return (
      <Group>
        {cardIds.map((id, i) => {
          const c = card(id);
          return c ? <ListRow key={id} first={i === 0} icon="clipboard" title={c.procedure} subtitle={cardSubtitle(c)} onPress={() => onOpenSelection({ type: 'card', id })} /> : null;
        })}
        {itemIds.map((id, i) => {
          const it = item(id);
          return it ? (
            <ListRow key={id} first={i === 0 && cardIds.length === 0} icon={itemIcon(it.category)} title={it.name} subtitle={itemLocation(it)} onPress={() => onOpenSelection({ type: 'item', id })} />
          ) : null;
        })}
      </Group>
    );
  }

  if (a.type === 'switch_department') {
    const active = lib.deptId === a.department_id;
    return (
      <Button
        kind="secondary"
        icon={active ? 'check' : 'briefcase'}
        label={active ? `Now in ${departmentLabel(lib.data, a.department_id)}` : `Switch to ${departmentLabel(lib.data, a.department_id)}`}
        disabled={active}
        onPress={() => lib.setDept(a.department_id)}
      />
    );
  }

  if (a.type === 'go_to') {
    return <Button kind="secondary" icon="arrow-right" label={`Open ${TAB_LABEL[a.tab]}`} onPress={() => onGoTo(a.tab)} />;
  }

  return <DraftView draft={a} index={index} m={m} lib={lib} omni={omni} />;
}

function DraftView({ draft, index, m, lib, omni }: { draft: Draft; index: number; m: OmniMessage; lib: Library; omni: Omnibar }) {
  const change = lib.deptId ? draftToChange(draft, lib.data, lib.deptId) : null;
  const state = m.drafts?.[index] ?? { state: 'ready' as const };
  if (!change) return null;
  // Shown with the same words the reviewer will see.
  const asRequest: ChangeRequest = { ...change, id: 'draft', proposed_by: lib.userId, status: 'pending', created_at: '' };
  const rows = reviewRows(lib.data, asRequest);
  return (
    <View style={styles.draft}>
      <View style={styles.draftTop}>
        <Badge label={state.state === 'sent' ? 'Sent for review' : 'Draft'} tone={state.state === 'sent' ? 'ok' : 'accent'} />
      </View>
      <Text style={T.bodyStrong}>{requestTitle(lib.data, asRequest)}</Text>
      {draft.summary ? <Text style={T.callout}>{draft.summary}</Text> : null}
      {rows.map((r) => (
        <View key={r.label} style={styles.draftRow}>
          <Text style={[T.callout, { width: 112 }]}>{r.label}</Text>
          <Text style={[T.body, { flex: 1 }]}>
            {change.kind === 'remove' ? r.before : change.kind === 'edit' && r.before !== r.after ? `${r.before} → ${r.after}` : r.after}
          </Text>
        </View>
      ))}
      {state.state === 'error' && <Text style={[T.callout, { color: C.danger }]}>{state.error}</Text>}
      {state.state === 'sent' ? (
        <Text style={T.callout}>A colleague in this department reviews it before it changes.</Text>
      ) : (
        <Button kind="secondary" icon="send" label="Send for review" busy={state.state === 'sending'} onPress={() => omni.sendDraft(m.id, index, draft)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: S.sm },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 132,
    borderRadius: R.control,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    color: C.text,
    fontSize: 17,
    paddingHorizontal: S.lg,
    paddingVertical: 14,
  },
  send: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  privacyText: { color: C.text3, fontSize: 13, flex: 1 },
  userWrap: { alignItems: 'flex-end', gap: S.xs },
  user: { maxWidth: '85%', backgroundColor: C.accentSoft, borderRadius: R.card, borderBottomRightRadius: 4, paddingHorizontal: S.lg, paddingVertical: S.md },
  note: { color: C.text3, fontSize: 13 },
  assistant: { alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.card, borderBottomLeftRadius: 4, padding: S.lg, gap: S.sm },
  draft: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.accent, borderRadius: R.card, padding: S.lg, gap: S.sm },
  draftTop: { flexDirection: 'row' },
  draftRow: { flexDirection: 'row', gap: S.sm },
});
