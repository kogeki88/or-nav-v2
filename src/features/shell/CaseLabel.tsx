// The case label in the top bar, and its live dot (also used by the sidebar's current case).
// Unknown case: the time name in quiet text and a grey dot. Known: the name on a fill, and a green
// dot that breathes slowly (about 3.2 s, opacity and scale). When the case learns, the text
// cross-fades and one faint green ring goes out once. Reduce motion: no breathing, no ring; the
// text only fades. Built-in Animated only.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { C, F } from '../../theme';
import { EASE, useReduceMotion } from '../../ui/motion';

const PILL = 36;
const BREATH_MS = 1600; // each half of the 3.2 s breath
const RING_MS = 1100;
const RING_GROW = 12; // the ring goes out this far around the label

/** Grey when the case is unknown; green and breathing once it is known (still when motion is reduced). */
export function BreathingDot({ known, reduceMotion, size = 7 }: { known: boolean; reduceMotion: boolean; size?: number }) {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    breath.setValue(0);
    if (!known || reduceMotion) return;
    const half = (toValue: number) => Animated.timing(breath, { toValue, duration: BREATH_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([half(1), half(0)]));
    loop.start();
    return () => loop.stop();
  }, [breath, known, reduceMotion]);
  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });
  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: known ? C.accent : C.text3, opacity, transform: [{ scale }] }}
    />
  );
}

type Props = {
  label: string;
  known: boolean;
  /** Goes up each time the case learns by itself: plays the ring once. */
  learned: number;
  onPress: () => void;
};

export default function CaseLabel({ label, known, learned, onPress }: Props) {
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState({ label, known });
  const fade = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  // Cross-fade: the old text fades out, the newest one fades in. A new animation on `fade` stops
  // the one before it (finished = false), so quick changes never leave an old label on screen.
  const target = useRef({ label, known });
  target.current = { label, known };
  const showing = useRef(shown);
  showing.current = shown;
  useEffect(() => {
    const fadeIn = () => Animated.timing(fade, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    if (label === showing.current.label && known === showing.current.known) return fadeIn();
    Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setShown(target.current);
      fadeIn();
    });
  }, [fade, label, known]);

  // One faint ring when the case learns (never on the first draw, never with reduce motion).
  const firstLearned = useRef(learned);
  useEffect(() => {
    if (learned === firstLearned.current || reduceMotion) return;
    ring.setValue(0);
    Animated.timing(ring, { toValue: 1, duration: RING_MS, easing: EASE, useNativeDriver: true }).start();
  }, [learned, reduceMotion, ring]);

  const ringStyle = {
    opacity: ring.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.6, 0] }),
    transform: [
      { scaleX: ring.interpolate({ inputRange: [0, 1], outputRange: [1, width > 0 ? 1 + (2 * RING_GROW) / width : 1] }) },
      { scaleY: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + (2 * RING_GROW) / PILL] }) },
    ],
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Current case: ${label}. Change the case`}
      style={styles.target}
      hitSlop={4}
    >
      {({ pressed }) => (
        <View style={styles.wrap}>
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
          <View
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={[styles.pill, shown.known && { backgroundColor: C.fill }, pressed && { backgroundColor: C.fill2 }]}
          >
            <BreathingDot known={shown.known} reduceMotion={reduceMotion} />
            <Animated.Text style={[styles.text, { color: shown.known ? C.text : C.text2, opacity: fade }]} numberOfLines={1}>
              {shown.label}
            </Animated.Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  wrap: { maxWidth: '100%' },
  pill: { height: PILL, borderRadius: PILL / 2, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: PILL / 2, borderWidth: 2, borderColor: C.accent },
  text: { fontFamily: F, fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
