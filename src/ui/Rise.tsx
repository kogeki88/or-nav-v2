// Shared moving pieces (ticket #17), built on the rules in motion.ts.
// Rise: a row fades in and moves into place once, when it first shows. Never on scroll.
// FadeWords: a new AI answer fades in word by word.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';

import { EASE, FADE_MS, RISE_MS, RISE_PX, SLIDE_PX, revealSpans, revealTime, useReduceMotion, withAlpha } from './motion';

export function Rise({
  children,
  delay = 0,
  from = 'below',
  play = true,
  style,
}: {
  children: ReactNode;
  /** Wait before it starts (ms); use staggerDelay() for lists. */
  delay?: number;
  from?: 'below' | 'left';
  /** Read once, when the row first shows. False: the row is simply there. */
  play?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const playing = useRef(play).current;
  const t = useRef(new Animated.Value(playing ? 0 : 1)).current;
  useEffect(() => {
    if (!playing) return;
    const anim = Animated.timing(t, { toValue: 1, delay, duration: reduce ? FADE_MS : RISE_MS, easing: EASE, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
    // Plays once, on mount; a later change in reduce motion does not restart it.
  }, []);
  const shift = reduce ? 0 : from === 'left' ? -SLIDE_PX : RISE_PX;
  const move = t.interpolate({ inputRange: [0, 1], outputRange: [shift, 0] });
  const transform = from === 'left' ? [{ translateX: move }] : [{ translateY: move }];
  return <Animated.View style={[style, { opacity: t, transform }]}>{children}</Animated.View>;
}

const TICK_MS = 40;

export function FadeWords({ text, color, style, play }: { text: string; color: string; style?: StyleProp<TextStyle>; play: boolean }) {
  const reduce = useReduceMotion();
  const playing = useRef(play).current;
  const [elapsed, setElapsed] = useState(playing ? 0 : Infinity);
  const fade = useRef(new Animated.Value(playing ? 0 : 1)).current;
  const total = revealTime(text);

  useEffect(() => {
    if (!playing) return;
    if (reduce) {
      setElapsed(Infinity);
      const anim = Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true });
      anim.start();
      return () => anim.stop();
    }
    fade.setValue(1);
    const start = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      if (ms >= total) clearInterval(id);
    }, TICK_MS);
    return () => clearInterval(id);
    // Plays once, on mount.
  }, []);

  if (elapsed >= total) {
    return <Animated.Text style={[style, { color, opacity: fade }]}>{text}</Animated.Text>;
  }
  // One Text with see-through spans keeps the final line breaks, so nothing jumps.
  return (
    <Text style={[style, { color }]} accessibilityLabel={text}>
      {revealSpans(text, elapsed).map((s, i) => (
        <Text key={i} style={{ color: withAlpha(color, s.alpha) }}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}
