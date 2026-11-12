// The admins' floating feedback button and its form (tickets #19 and #20: saved first, sent when online; no screenshot yet).
// Drawn last in SignedIn (App.tsx), so it sits above every tab and panel. The shell decides who sees it.
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import type { FeedbackSender, FeedbackTag } from '../../contracts/feedback';
import { C, S, T } from '../../theme';
import BottomSheet from '../../ui/BottomSheet';
import { Banner, Button, Chips, Field, Icon, IconButton, PressScale } from '../../ui/kit';
import { TAGS } from './logic';

/** How long "Sent" shows before the form closes. */
const SENT_MS = 1200;

type Props = {
  sender: FeedbackSender;
  /** The page name at the moment the button is tapped ("main / case panel"). */
  page: () => string;
  /** Space kept free at the bottom (the box), so the button never covers Send. */
  bottom: number;
};

export default function Feedback({ sender, page, bottom }: Props) {
  const [open, setOpen] = useState(false);
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

  const start = () => {
    setWhere(page());
    setTag('broken');
    setMessage('');
    setError('');
    setSent(null);
    setOpen(true);
  };
  const close = () => {
    if (!busy) setOpen(false);
  };
  const send = async () => {
    setBusy(true);
    setError('');
    const result = await sender.submit({ tag, message, page: where });
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
      {!open && (
        <View style={[styles.fabHolder, { bottom }]} pointerEvents="box-none">
          <PressScale accessibilityLabel="Send feedback" onPress={start} style={styles.fab}>
            <Icon name="message-square" size={22} color={C.onAccent} />
          </PressScale>
        </View>
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
  fabHolder: { position: 'absolute', right: S.md },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    opacity: 0.92,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  actions: { flexDirection: 'row', gap: S.md },
});
