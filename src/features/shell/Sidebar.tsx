// The sidebar: slides in from the left with a spring. Opens by ☰ or a swipe from the left edge;
// closes by a tap on the dim area, a swipe back to the left, or Android Back (see Shell).
// Built-in Animated + PanResponder only. Reduce motion: it appears and goes without sliding.
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CaseListRow } from '../../contracts/cases';
import { C, F, R, S, T } from '../../theme';
import { Avatar, Icon, IconName } from '../../ui/kit';
import { GAP, SPRING, staggerDelay, useReduceMotion } from '../../ui/motion';
import { Rise } from '../../ui/Rise';
import { BreathingDot } from './CaseLabel';
import type { SidebarRow } from './logic';

const ROW_ICON: Record<SidebarRow['key'], IconName> = { new: 'plus', library: 'book-open', review: 'check-circle' };
/** Width of the strip on the left edge that starts the swipe. */
const EDGE = 24;

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  rows: SidebarRow[];
  onRow: (key: SidebarRow['key']) => void;
  /** Recent cases, the current one marked; a tap switches to it. */
  cases: CaseListRow[];
  onCase: (caseId: string) => void;
  person: { name: string; fullName: string; emoji: string | null };
  onPerson: () => void;
  /** Where the edge strip starts and stops, so it never covers the top bar or the box. */
  edgeTop: number;
  edgeBottom: number;
};

export default function Sidebar({ open, onOpen, onClose, rows, onRow, cases, onCase, person, onPerson, edgeTop, edgeBottom }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(300, Math.round(width * 0.82));
  const x = useRef(new Animated.Value(-W)).current;
  const [shown, setShown] = useState(open);
  const reduceMotion = useReduceMotion();
  const live = useRef({ W, onOpen, onClose });
  live.current = { W, onOpen, onClose };

  const settle = (to: number, done?: () => void) => {
    const anim = reduceMotion
      ? Animated.timing(x, { toValue: to, duration: 0, useNativeDriver: true })
      : Animated.spring(x, { toValue: to, ...SPRING, useNativeDriver: true });
    anim.start(({ finished }) => finished && done?.());
  };

  useEffect(() => {
    if (open) {
      setShown(true);
      settle(0);
    } else {
      settle(-live.current.W, () => setShown(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduceMotion]);

  // Swipe from the left edge: the sidebar follows the finger, then opens or slides back.
  const edge = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        x.setValue(-live.current.W);
        setShown(true);
      },
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, -live.current.W + g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx > live.current.W / 3 || g.vx > 0.5) live.current.onOpen();
        else settle(-live.current.W, () => setShown(false));
      },
      onPanResponderTerminate: () => settle(-live.current.W, () => setShown(false)),
    }),
  ).current;

  // Swipe back to the left on the open sidebar or the dim area closes it.
  const back = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -live.current.W / 3 || g.vx < -0.5) live.current.onClose();
        else settle(0);
      },
      onPanResponderTerminate: () => settle(0),
    }),
  ).current;

  // Rows rise in from the left, one after another, each time the sidebar opens.
  const rise = (i: number) => staggerDelay(i, GAP.sidebar);
  const dim = x.interpolate({ inputRange: [-W, 0], outputRange: [0, 0.65], extrapolate: 'clamp' });

  return (
    <>
      {!open && <View {...edge.panHandlers} style={[styles.edge, { top: edgeTop, bottom: edgeBottom }]} />}
      {shown && (
        <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'} {...back.panHandlers}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: dim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close the sidebar" />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel="Sidebar"
            style={[styles.drawer, { width: W, paddingTop: insets.top + S.lg, paddingBottom: insets.bottom + S.md, transform: [{ translateX: x }] }]}
          >
            {rows.map((r, i) => (
              <Rise key={r.key} from="left" delay={rise(i)}>
                {r.key === 'new' ? (
                  <Pressable accessibilityRole="button" onPress={() => onRow(r.key)} style={({ pressed }) => [styles.newCase, pressed && { backgroundColor: C.fill }]}>
                    <Icon name={ROW_ICON[r.key]} size={20} color={C.text} />
                    <Text style={styles.newCaseText}>{r.label}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={r.count ? `${r.label}, ${r.count} waiting` : r.label}
                    onPress={() => onRow(r.key)}
                    style={({ pressed }) => [styles.nav, pressed && { backgroundColor: C.fill }]}
                  >
                    <Icon name={ROW_ICON[r.key]} size={20} color={C.text2} />
                    <Text style={styles.navText}>{r.label}</Text>
                    {r.count ? <Text style={styles.count}>{r.count}</Text> : null}
                  </Pressable>
                )}
              </Rise>
            ))}

            <Rise from="left" delay={rise(rows.length)}>
              <Text style={styles.heading} accessibilityRole="header">
                Cases
              </Text>
            </Rise>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2 }}>
              {cases.map((c, i) => (
                <Rise key={c.id} from="left" delay={rise(rows.length + 1 + i)}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${c.label}, ${c.when}${c.current ? ', current case' : ''}`}
                    accessibilityState={{ selected: c.current }}
                    onPress={() => onCase(c.id)}
                    style={({ pressed }) => [styles.case, c.current && styles.caseCurrent, pressed && { backgroundColor: C.fill }]}
                  >
                    {c.current && <BreathingDot known={c.known} reduceMotion={reduceMotion} size={6} />}
                    <Text style={[styles.caseText, c.current && styles.caseTextCurrent]} numberOfLines={1}>
                      {c.label}
                    </Text>
                    <Text style={styles.caseWhen}>{c.when}</Text>
                  </Pressable>
                </Rise>
              ))}
            </ScrollView>

            <Rise from="left" delay={rise(rows.length + 1 + cases.length)}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${person.name}. Your settings`} onPress={onPerson} style={({ pressed }) => [styles.me, pressed && { backgroundColor: C.fill }]}>
                <Avatar emoji={person.emoji} name={person.fullName} size={36} />
                <Text style={styles.meName} numberOfLines={1}>
                  {person.name}
                </Text>
              </Pressable>
            </Rise>
          </Animated.View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, width: EDGE },
  scrim: { backgroundColor: '#000' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: C.raised,
    borderTopRightRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingHorizontal: S.md,
  },
  newCase: { minHeight: 48, borderRadius: 24, backgroundColor: C.fill2, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, marginBottom: S.sm },
  newCaseText: { fontFamily: F, color: C.text, fontSize: 16, fontWeight: '600' },
  nav: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  navText: { fontFamily: F, color: C.text, fontSize: 16, fontWeight: '500', flex: 1 },
  count: { fontFamily: F, color: C.warn, fontSize: 15, fontWeight: '700' },
  heading: { ...T.callout, fontSize: 14, color: C.text3, fontWeight: '500', paddingTop: S.xl, paddingBottom: 6, paddingHorizontal: 18 },
  case: { minHeight: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 },
  caseCurrent: { backgroundColor: C.fill },
  caseText: { fontFamily: F, color: C.text2, fontSize: 16, flex: 1 },
  caseTextCurrent: { color: C.text, fontWeight: '600' },
  caseWhen: { fontFamily: F, color: C.text3, fontSize: 13 },
  me: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: 10 },
  meName: { fontFamily: F, color: C.text, fontSize: 16, fontWeight: '600', flex: 1 },
});
