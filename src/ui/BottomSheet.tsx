// The preview sheet: slides up over a dimmed screen. Closes by swipe down, tap on the dim area,
// the close button (inside the content) or Android Back. Reduce motion: fades only.
// Drawn inside the app's own window (not a Modal): a Modal is a separate Android window that
// the system shifts up when the keyboard opens, which pushed the sheet under the status bar.
// The parent must cover the whole screen (see SignedIn in App.tsx) so the dim layer covers the tab bar.
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, R, S } from '../theme';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Stays fixed at the top (title, close button). Dragging it down closes the sheet. */
  header: ReactNode;
  children: ReactNode;
  /** Stays fixed at the bottom, in thumb reach (the one main action). */
  footer?: ReactNode;
  label: string;
  /** Chat-style: keep the newest content (the end) in view as it grows. */
  stickToEnd?: boolean;
};

export default function BottomSheet({ open, onClose, header, children, footer, label, stickToEnd }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const [reduceMotion, setReduceMotion] = useState(false);
  const y = useRef(new Animated.Value(height)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Keep the sheet above the keyboard and below the status bar. The keyboard event gives the
  // keyboard's top edge on screen; the sheet's own container (full screen, measured below) gives
  // the real drawing height. Window size is not used: in edge-to-edge mode it excludes the system
  // bars while the app draws under them, so it would lift the sheet from the wrong edge.
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [frame, setFrame] = useState(height);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboardTop(e.endCoordinates.screenY));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      y.setValue(reduceMotion ? 0 : height);
      Animated.parallel([
        reduceMotion
          ? Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true })
          : Animated.spring(y, { toValue: 0, damping: 26, stiffness: 260, mass: 0.9, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        reduceMotion
          ? Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true })
          : Animated.timing(y, { toValue: height, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduceMotion, height]);

  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.1) closeRef.current();
        else Animated.spring(y, { toValue: 0, damping: 24, stiffness: 300, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  // Android Back closes the sheet first.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  if (!mounted) return null;

  const keyboard = keyboardTop === null ? 0 : Math.max(0, frame - keyboardTop);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(e) => setFrame(e.nativeEvent.layout.height)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <View style={styles.holder} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={[
            styles.sheet,
            {
              maxHeight: frame - insets.top - S.xl - keyboard,
              marginBottom: keyboard,
              paddingBottom: keyboard > 0 ? S.md : insets.bottom + S.md,
              opacity: reduceMotion ? fade : 1,
              transform: [{ translateY: y }],
            },
          ]}
        >
          <View {...drag.panHandlers} style={styles.top}>
            <View style={styles.handle} />
            {header}
          </View>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            onContentSizeChange={stickToEnd ? () => scrollRef.current?.scrollToEnd({ animated: true }) : undefined}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: C.scrim },
  holder: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.raised,
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.line,
    overflow: 'hidden',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  top: { paddingHorizontal: S.lg, paddingBottom: S.sm },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.handle, marginTop: S.sm, marginBottom: S.md },
  body: { paddingHorizontal: S.lg, paddingBottom: S.lg, gap: S.md },
  footer: { paddingHorizontal: S.lg, paddingTop: S.md, gap: S.sm, borderTopWidth: 1, borderTopColor: C.line },
});
