// The greeting on a new, empty case (ticket #17): a faint pool of green light behind it, the two
// lines rise in, and one heartbeat line draws once under them, then rests dim.
// Reduce motion: the light, the lines and the heartbeat only fade in.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { C, F } from '../theme';
import { EASE, FADE_MS, GAP, staggerDelay, useReduceMotion } from '../ui/motion';
import { Rise } from '../ui/Rise';

const heartbeat = require('../../assets/heartbeat.png');

/** When the lines start, after the light comes on (from the mockup). */
const LINES_AT = 300;
/** When the heartbeat starts to draw, and how long it takes. */
const TRACE_AT = LINES_AT + GAP.greeting + 250;
const TRACE_MS = 1400;
/** When "Pick up a case" may start to rise. */
export const INTRO_MS = 1300;

const TRACE_W = 120;
const TRACE_H = 24;
const GREET_TOP = 52;
const LINE_H = 36;
const TRACE_GAP = 22;
/** Height of the greeting below the top bar: its top space, two lines and the heartbeat. */
export const GREETING_SPACE = GREET_TOP + 2 * LINE_H + TRACE_GAP + TRACE_H;
const GREET_SIZE = 30;
/** Empty space between the top bar and the greeting's first letters: its top space and the line's extra height above the text. */
export const GREETING_STRIP = GREET_TOP + (LINE_H - GREET_SIZE) / 2;

/** The light pool. It sits at the top of the empty screen, behind everything. */
export function LightPool({ play }: { play: boolean }) {
  const reduce = useReduceMotion();
  const o = useRef(new Animated.Value(play ? 0 : 1)).current;
  useEffect(() => {
    if (!play) return;
    const anim = Animated.timing(o, { toValue: 1, duration: reduce ? FADE_MS : 1600, easing: EASE, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.pool, { opacity: o }]} />;
}

/** `shift` adds space above the greeting (ticket #35: room for the feedback button on a short screen). */
export function Greeting({ lines, play, shift = 0 }: { lines: [string, string]; play: boolean; shift?: number }) {
  return (
    <View style={[styles.greeting, shift > 0 && { marginTop: GREET_TOP + shift }]}>
      <Rise play={play} delay={LINES_AT + staggerDelay(0, GAP.greeting)}>
        <Text style={styles.greetText}>{lines[0]}</Text>
      </Rise>
      <Rise play={play} delay={LINES_AT + staggerDelay(1, GAP.greeting)}>
        <Text style={[styles.greetText, { color: C.text3 }]}>{lines[1]}</Text>
      </Rise>
      <Heartbeat play={play} />
    </View>
  );
}

/** A bundled picture, shown through a clip that widens from left to right. No SVG library. */
function Heartbeat({ play }: { play: boolean }) {
  const reduce = useReduceMotion();
  const width = useRef(new Animated.Value(play && !reduce ? 0 : TRACE_W)).current;
  const opacity = useRef(new Animated.Value(play ? (reduce ? 0 : 0.9) : 0.35)).current;
  useEffect(() => {
    if (!play) return;
    const anim = reduce
      ? Animated.sequence([Animated.delay(TRACE_AT), Animated.timing(opacity, { toValue: 0.35, duration: FADE_MS * 2, useNativeDriver: false })])
      : Animated.sequence([
          Animated.delay(TRACE_AT),
          // Width cannot use the native driver; it is one small view for 1.4 s.
          Animated.timing(width, { toValue: TRACE_W, duration: TRACE_MS, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0.35, duration: 1200, easing: EASE, useNativeDriver: false }),
        ]);
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.trace, { width, opacity }]}>
      <Image source={heartbeat} style={styles.traceImg} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pool: {
    position: 'absolute',
    top: -160,
    left: '50%',
    marginLeft: -260,
    width: 520,
    height: 420,
    experimental_backgroundImage: 'radial-gradient(closest-side, rgba(125,211,184,0.10), rgba(125,211,184,0.03) 55%, transparent)',
  },
  greeting: { marginTop: GREET_TOP, paddingHorizontal: 20 },
  greetText: { fontFamily: F, color: C.text, fontSize: GREET_SIZE, lineHeight: LINE_H, fontWeight: '600' },
  trace: { marginTop: TRACE_GAP, height: TRACE_H, overflow: 'hidden' },
  traceImg: { width: TRACE_W, height: TRACE_H },
});
