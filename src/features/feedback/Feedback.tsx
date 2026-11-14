// The admins' floating feedback button and its form (tickets #19 and #20: saved first, sent when online).
// Ticket #23: a tap hides the button, takes a picture of the page, then opens the form; the picture goes with the report.
// Ticket #21: drag the button and drop it; it snaps to the nearest corner, saved on the phone.
// Drawn last in SignedIn (App.tsx), so it sits above every tab and panel. The shell decides who sees it.
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { FeedbackSender, FeedbackTag } from '../../contracts/feedback';
import { C, S, T } from '../../theme';
import BottomSheet from '../../ui/BottomSheet';
import { Banner, Button, Chips, Field, Icon, IconButton, PressScale } from '../../ui/kit';
import { logFault } from '../../diag/faultStore';
import { type Corner, cornerSpot, FEEDBACK_BUTTON, isDrag, nearestCorner, readCorner, shootWithoutButton, TAGS } from './logic';

/** Waits until the screen has drawn the latest change (two frames, then a short pause for the native side). */
function afterPaint(): Promise<void> {
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 50))));
}

/** The button's corner, saved on the phone so it stays after a restart. */
const CORNER_KEY = 'ornav.feedback.corner';

function savedCorner(): Corner {
  try {
    return readCorner(localStorage.getItem(CORNER_KEY));
  } catch (e) {
    logFault('feedback', e);
    return readCorner(null);
  }
}

/** How long "Sent" shows before the form closes. */
const SENT_MS = 1200;

type Props = {
  sender: FeedbackSender;
  /** The page name at the moment the button is tapped ("main / case panel"). */
  page: () => string;
  /** Space kept free at the bottom (the box and the pick-up list), so the button never covers Send or a row. */
  bottom: number;
  /** Space kept free at the top (the top bar and the greeting), so the button never covers them. */
  top: number;
  /** Takes a picture of the whole screen and gives its file uri. */
  capture: () => Promise<string>;
};

export default function Feedback({ sender, page, bottom, top, capture }: Props) {
  const [open, setOpen] = useState(false);
  /** The button is hidden while the picture is taken. */
  const [shooting, setShooting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const busyShot = useRef(false);
  const [where, setWhere] = useState('');
  const [tag, setTag] = useState<FeedbackTag>('broken');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<'sent' | 'saved' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  // Waiting reports go out on app start and on each return to the app.
  useEffect(() => {
    void sender.flush();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void sender.flush());
    return () => sub.remove();
  }, [sender]);

  // Dragging: the button follows the finger, then snaps to the nearest corner on drop.
  // A move past the tap slop takes the touch from the button, so a drag never opens the form.
  const [corner, setCorner] = useState<Corner>(savedCorner);
  const screen = useWindowDimensions();
  const size = useRef(screen);
  size.current = screen;
  const pan = useRef(new Animated.ValueXY()).current;
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => isDrag(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        const next = nearestCorner(g.moveX, g.moveY, size.current.width, size.current.height);
        pan.setValue({ x: 0, y: 0 });
        setCorner(next);
        try {
          localStorage.setItem(CORNER_KEY, next);
        } catch (e) {
          logFault('feedback', e);
        }
      },
      onPanResponderTerminate: () => pan.setValue({ x: 0, y: 0 }),
    }),
  ).current;
  const spot = cornerSpot(corner, { top, bottom, side: S.md });

  const start = async () => {
    // A ref, not the state, so a quick double tap still takes one picture.
    if (busyShot.current) return;
    busyShot.current = true;
    setWhere(page());
    setTag('broken');
    setMessage('');
    setError('');
    setSent(null);
    // The picture is taken before the form opens, with the button hidden.
    const shot = await shootWithoutButton({
      hide: () => {
        setShooting(true);
        return afterPaint();
      },
      capture,
      onFault: (e) => logFault('feedback', e),
    });
    setScreenshot(shot);
    setShooting(false);
    setOpen(true);
    busyShot.current = false;
  };
  const close = () => {
    if (!busy) setOpen(false);
  };
  const send = async () => {
    setBusy(true);
    setError('');
    const result = await sender.submit({ tag, message, page: where, screenshot });
    setBusy(false);
    if (result.kind === 'error') {
      setError(result.message);
      return;
    }
    setSent(result.kind);
    timer.current = setTimeout(() => setOpen(false), SENT_MS);
  };

  return (
    <>
      {!open && !shooting && (
        <Animated.View style={[styles.fabHolder, spot, { transform: pan.getTranslateTransform() }]} {...drag.panHandlers}>
          <PressScale accessibilityLabel="Send feedback. Drag to move it to another corner." onPress={start} style={styles.fab}>
            <Icon name="message-square" size={22} color={C.onAccent} />
          </PressScale>
        </Animated.View>
      )}
      <BottomSheet
        open={open}
        onClose={close}
        label="Send feedback"
        header={
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={T.headline} accessibilityRole="header">
                Send feedback
              </Text>
              <Text style={T.callout} numberOfLines={1}>
                {`Page: ${where}`}
              </Text>
            </View>
            <IconButton name="x" label="Close" onPress={close} />
          </View>
        }
        footer={
          sent === 'sent' ? (
            <Banner text="Sent" tone="ok" icon="check-circle" />
          ) : sent === 'saved' ? (
            <Banner text="Saved, will send when online" tone="warn" icon="cloud-off" />
          ) : (
            <View style={styles.actions}>
              <Button label="Cancel" kind="secondary" onPress={close} disabled={busy} style={{ flex: 1 }} />
              <Button label="Send" icon="send" onPress={send} busy={busy} disabled={message.trim() === ''} style={{ flex: 1 }} pop />
            </View>
          )
        }
      >
        <Chips options={TAGS} value={tag} onChange={setTag} />
        <Field label="Message" value={message} onChange={setMessage} multiline placeholder="What did you see? Tap the mic on the keyboard to speak." editable={!busy && !sent} />
        {error !== '' && <Banner text={error} tone="danger" icon="alert-triangle" />}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  fabHolder: { position: 'absolute' },
  fab: {
    width: FEEDBACK_BUTTON,
    height: FEEDBACK_BUTTON,
    borderRadius: FEEDBACK_BUTTON / 2,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    opacity: 0.92,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  actions: { flexDirection: 'row', gap: S.md },
});
