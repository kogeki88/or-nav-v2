// The one box on the main screen: the composer at the bottom, and above it the greeting, the
// conversation with the AI, and the matches while typing. Matches come from the search port.
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CaseListRow } from '../contracts/cases';
import type { ChangeRequest } from '../contracts/library';
import type { LibrarySearch } from '../contracts/search';
import { itemIcon } from '../features/library/icons';
import type { Selection } from '../features/library/LibrarySheet';
import { departmentLabel, requestTitle, reviewRows } from '../features/library/logic';
import type { Library } from '../features/library/useLibrary';
import { C, F, S, T } from '../theme';
import { Badge, Button, Icon, IconName, PressScale } from '../ui/kit';
import { GAP, revealTime, staggerDelay } from '../ui/motion';
import { FadeWords, Rise } from '../ui/Rise';
import type { GoTo, OmniAction } from '../../supabase/functions/omnibar/schema';
import { FreshBase, answerRows, boxMatches, freshBase, shelfBin } from './boxLogic';
import { Greeting, INTRO_MS, LightPool } from './Greeting';
import type { OmniMessage, Omnibar } from './useOmnibar';
import { Draft, draftToChange } from './validate';

const BOX = 56;
const PAD_TOP = S.sm;
const PAD_BOTTOM = S.md;
/** Height of the composer above the bottom safe area. */
export const COMPOSER_SPACE = BOX + PAD_TOP + PAD_BOTTOM;

const GO_TO_LABEL: Record<GoTo['tab'], string> = { library: 'Library', review: 'To review', me: 'your name' };

export function Composer({ text, onChangeText, onSend, busy }: { text: string; onChangeText: (t: string) => void; onSend: () => void; busy: boolean }) {
  const on = text.trim() !== '' && !busy;
  return (
    <View style={styles.composer}>
      <View style={styles.box}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="Find an item or ask"
          placeholderTextColor={C.text3}
          style={styles.input}
          maxLength={1000}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={() => on && onSend()}
          accessibilityLabel="Find an item or ask the AI"
        />
        {/* Voice comes later (Brick 7): the mic is drawn only, and steps aside while typing. */}
        {text === '' && (
          <View style={styles.mic} accessibilityLabel="Voice, coming later" accessible>
            <Icon name="mic" size={22} color={C.text3} />
          </View>
        )}
        <PressScale
          pop
          onPress={onSend}
          disabled={!on}
          accessibilityLabel={busy ? 'Sending' : 'Send to the AI'}
          accessibilityState={{ busy }}
          style={[styles.send, { backgroundColor: on ? C.accent : C.fill2 }]}
        >
          {busy ? <ActivityIndicator color={C.text3} /> : <Icon name="arrow-up" size={22} color={on ? C.onAccent : C.text3} />}
        </PressScale>
      </View>
    </View>
  );
}

type BodyProps = {
  omni: Omnibar;
  lib: Library;
  /** This department's search index (the search port). */
  index: LibrarySearch;
  text: string;
  greeting: [string, string];
  /** A short line above the greeting (the welcome after the setup questions). */
  notice?: ReactNode;
  onOpen: (s: Selection) => void;
  onGoTo: (tab: GoTo['tab']) => void;
  /** "Pick up a case" on an empty case: the most recent other cases. */
  pickUp: CaseListRow[];
  onPickUp: (caseId: string) => void;
  /** The card the case knows: its line sits at the top of the conversation. */
  caseCard?: { id: string; title: string; count: number } | null;
};

export function OneBoxBody({ omni, lib, index, text, greeting, notice, onOpen, onGoTo, pickUp, onPickUp, caseCard }: BodyProps) {
  const scroll = useRef<ScrollViewInstance>(null);
  const matches = useMemo(() => boxMatches(text, index, lib.data, lib.deptId), [text, index, lib.data, lib.deptId]);
  const typing = text.trim() !== '';
  const open = (s: Selection) => {
    Keyboard.dismiss();
    onOpen(s);
  };
  // Only messages that arrive while the case is open animate; a reopened case stays still.
  const base = useRef<FreshBase | null>(null);
  base.current = freshBase(base.current, omni.caseId, omni.messages);
  const fresh = (m: OmniMessage) => m.id > base.current!.maxId;
  // The greeting plays its intro once per case.
  const introPlayed = useRef(new Set<string>());
  const showGreeting = omni.caseId !== null && omni.messages.length === 0 && !typing;
  const playIntro = omni.caseId !== null && !introPlayed.current.has(omni.caseId);
  useEffect(() => {
    if (showGreeting && omni.caseId) introPlayed.current.add(omni.caseId);
  }, [showGreeting, omni.caseId]);

  return (
    <View style={{ flex: 1 }}>
      {caseCard && !typing && (
        <Rise style={styles.cardLine}>
          <Text style={[T.callout, { flex: 1 }]} numberOfLines={1}>
            {/* The count comes first, so a long card name is cut at its end and the count stays visible. */}
            {`${caseCard.count} ${caseCard.count === 1 ? 'item' : 'items'} · ${caseCard.title}`}
          </Text>
          <Button kind="secondary" pop label="Open" icon="clipboard" onPress={() => open({ type: 'card', id: caseCard.id })} />
        </Rise>
      )}
      {omni.messages.length === 0 ? (
        <View style={{ flex: 1, overflow: 'hidden' }}>
          {showGreeting && <LightPool key={`pool-${omni.caseId}`} play={playIntro} />}
          {notice}
          {showGreeting && <Greeting key={`greet-${omni.caseId}`} lines={greeting} play={playIntro} />}
          {showGreeting && pickUp.length > 0 && (
            <View key={`pick-${omni.caseId}`} style={styles.pickUp}>
              <Rise play={playIntro} delay={INTRO_MS}>
                <Text style={styles.pickUpHead} accessibilityRole="header">
                  Pick up a case
                </Text>
              </Rise>
              {pickUp.map((c, i) => (
                <Rise key={c.id} play={playIntro} delay={INTRO_MS + staggerDelay(i + 1, GAP.cases)}>
                  <Pressable
                    onPress={() => onPickUp(c.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Pick up ${c.label}, ${c.when}`}
                    style={({ pressed }) => [styles.pickUpRow, pressed && { backgroundColor: C.fill }]}
                  >
                    <Text style={styles.matchTitle} numberOfLines={1}>
                      {c.label}
                    </Text>
                    <Text style={styles.pickUpWhen}>{c.when}</Text>
                  </Pressable>
                </Rise>
              ))}
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {omni.messages.map((m) => (
            <Message key={m.id} m={m} fresh={fresh(m)} lib={lib} omni={omni} onOpen={open} onGoTo={onGoTo} />
          ))}
          {omni.busy && (
            <View style={styles.thinking}>
              <ActivityIndicator color={C.text3} size="small" />
              <Text style={[T.callout, { color: C.text3 }]}>Thinking…</Text>
            </View>
          )}
        </ScrollView>
      )}

      {typing && (
        <ScrollView style={styles.matches} contentContainerStyle={{ paddingBottom: S.xs }} keyboardShouldPersistTaps="handled">
          {matches.items.length + matches.cards.length === 0 && <Text style={styles.groupHead}>No matches. Send to ask the AI.</Text>}
          {matches.items.length > 0 && <Text style={styles.groupHead}>{matches.items.length === 1 ? 'Item' : 'Items'}</Text>}
          {matches.items.map((it, i) => (
            <Rise key={it.id} delay={staggerDelay(i, GAP.matches)}>
              <MatchRow icon={itemIcon(it.category)} title={it.name} right={shelfBin(it) || 'No location yet'} strong onPress={() => open({ type: 'item', id: it.id })} />
            </Rise>
          ))}
          {matches.cards.length > 0 && <Text style={styles.groupHead}>On these cards</Text>}
          {matches.cards.map((c, i) => (
            <Rise key={c.id} delay={staggerDelay(matches.items.length + i, GAP.matches)}>
              <MatchRow icon="clipboard" title={c.procedure} right={c.surgeon} onPress={() => open({ type: 'card', id: c.id })} />
            </Rise>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MatchRow({ icon, title, right, strong, onPress }: { icon: IconName; title: string; right: string; strong?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${right}`} style={({ pressed }) => [styles.matchRow, pressed && { backgroundColor: C.fill }]}>
      <Icon name={icon} size={20} color={C.text2} />
      <Text style={styles.matchTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.matchRight, strong && { fontWeight: '700', color: C.text }]} numberOfLines={1}>
        {right}
      </Text>
    </Pressable>
  );
}

function Message({
  m,
  fresh,
  lib,
  omni,
  onOpen,
  onGoTo,
}: {
  m: OmniMessage;
  /** True when it arrived while the case was open: it animates in. */
  fresh: boolean;
  lib: Library;
  omni: Omnibar;
  onOpen: (s: Selection) => void;
  onGoTo: (t: GoTo['tab']) => void;
}) {
  if (m.role === 'user') {
    return (
      <Rise play={fresh} style={styles.userWrap}>
        <View style={styles.user}>
          <Text style={T.body}>{m.text}</Text>
        </View>
        {m.note ? <Text style={styles.note}>{m.note}</Text> : null}
      </Rise>
    );
  }
  const color = m.tone === 'danger' ? C.danger : m.tone === 'warn' ? C.warn : C.text;
  const actions = m.actions ?? [];
  const rows = answerRows(actions, lib.data);
  // The rows and buttons rise once the words are in.
  const after = revealTime(m.text);
  return (
    <View style={{ gap: S.sm }}>
      {m.engine === 'backup' ? <Badge label="Backup AI" tone="neutral" /> : null}
      <FadeWords text={m.text} color={color} style={styles.answer} play={fresh} />
      {m.note ? (
        <Rise play={fresh} delay={after}>
          <Text style={styles.note}>{m.note}</Text>
        </Rise>
      ) : null}
      {rows.length > 0 && (
        <View>
          {rows.map((r, i) => (
            <Rise key={r.kind === 'card' ? `c${r.card.id}` : `i${r.item.id}`} play={fresh} delay={after + staggerDelay(i, GAP.matches)}>
              {r.kind === 'card' ? (
                <AnswerRow first={i === 0} icon="clipboard" title={r.card.procedure} sub={r.card.surgeon} onPress={() => onOpen({ type: 'card', id: r.card.id })} />
              ) : (
                <AnswerRow
                  first={i === 0}
                  icon={itemIcon(r.item.category)}
                  title={r.item.name}
                  sub={shelfBin(r.item) || 'No location yet'}
                  tag={r.tag}
                  onPress={() => onOpen({ type: 'item', id: r.item.id })}
                />
              )}
            </Rise>
          ))}
        </View>
      )}
      {actions.map((a, i) => (
        <Rise key={i} play={fresh} delay={after + staggerDelay(rows.length + i, GAP.matches)}>
          <OtherAction a={a} index={i} m={m} lib={lib} omni={omni} onGoTo={onGoTo} />
        </Rise>
      ))}
    </View>
  );
}

function AnswerRow({ icon, title, sub, tag, first, onPress }: { icon: IconName; title: string; sub: string; tag?: 'open' | 'hold' | null; first: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, sub, tag].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.answerRow, first && { borderTopWidth: StyleSheet.hairlineWidth }, pressed && { backgroundColor: C.fill }]}
    >
      <Icon name={icon} size={20} color={C.text2} />
      <View style={{ flex: 1 }}>
        <Text style={styles.matchTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[T.callout, { fontSize: 14 }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {tag ? <Text style={[styles.tag, { color: tag === 'hold' ? C.warn : C.accent }]}>{tag === 'hold' ? 'Hold' : 'Open'}</Text> : null}
    </Pressable>
  );
}

/** Actions that are not item or card rows: switch department, go to a view, drafts. */
function OtherAction({ a, index, m, lib, omni, onGoTo }: { a: OmniAction; index: number; m: OmniMessage; lib: Library; omni: Omnibar; onGoTo: (t: GoTo['tab']) => void }) {
  if (a.type === 'open_item' || a.type === 'open_card' || a.type === 'show_results') return null;
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
  if (a.type === 'go_to') return <Button kind="secondary" icon="arrow-right" label={`Open ${GO_TO_LABEL[a.tab]}`} onPress={() => onGoTo(a.tab)} />;
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
      <View style={{ flexDirection: 'row' }}>
        <Badge label={state.state === 'sent' ? 'Sent for review' : 'Draft'} tone={state.state === 'sent' ? 'ok' : 'accent'} />
      </View>
      <Text style={T.bodyStrong}>{requestTitle(lib.data, asRequest)}</Text>
      {draft.summary ? <Text style={T.callout}>{draft.summary}</Text> : null}
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', gap: S.sm }}>
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
  composer: { paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM, paddingHorizontal: 14, backgroundColor: C.bg },
  box: { minHeight: BOX, borderRadius: BOX / 2, backgroundColor: C.fill, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 6, gap: 4 },
  input: { flex: 1, color: C.text, fontFamily: F, fontSize: 17, paddingVertical: 12 },
  mic: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardLine: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: 20, paddingTop: S.sm },
  pickUp: { marginTop: 'auto', paddingHorizontal: S.sm, paddingBottom: S.xs },
  pickUpHead: { fontFamily: F, color: C.text3, fontSize: 15, fontWeight: '500', paddingHorizontal: S.md, paddingBottom: S.xs },
  pickUpRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 56, paddingHorizontal: S.md, borderRadius: 12 },
  pickUpWhen: { fontFamily: F, color: C.text3, fontSize: 14 },
  thread: { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.lg, gap: S.lg },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  matches: { flexGrow: 0, flexShrink: 1, paddingHorizontal: S.sm },
  groupHead: { fontFamily: F, color: C.text3, fontSize: 14, paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: S.xs },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 52, paddingHorizontal: S.md, borderRadius: 12 },
  matchTitle: { flex: 1, fontFamily: F, color: C.text, fontSize: 17, fontWeight: '500' },
  matchRight: { fontFamily: F, color: C.text2, fontSize: 14, fontWeight: '600', maxWidth: '45%' },
  userWrap: { alignItems: 'flex-end', gap: S.xs },
  user: { maxWidth: '78%', backgroundColor: C.fill2, borderRadius: 22, paddingHorizontal: S.lg, paddingVertical: S.md },
  note: { fontFamily: F, color: C.text3, fontSize: 13 },
  answer: { fontFamily: F, fontSize: 17, lineHeight: 26 },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.hairline },
  tag: { fontFamily: F, fontSize: 14, fontWeight: '700' },
  draft: { backgroundColor: C.fill, borderRadius: 16, padding: S.lg, gap: S.sm },
});
