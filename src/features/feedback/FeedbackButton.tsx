// The floating feedback button (admins only) and its form sheet. The shell passes in the port and the
// page name; this folder never imports core. Hidden while the form is open, so the form is never covered.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedbackDraft, FeedbackPort, FeedbackTag } from '../../contracts/feedback';
import BottomSheet from '../../ui/BottomSheet';
import { Banner, Button, Field, Icon, Segmented } from '../../ui/kit';
import { C, S, T } from '../../theme';
import { FEEDBACK_TAGS, MAX_FEEDBACK_MESSAGE, canSendFeedback } from './logic';

/** How long "Sent" shows before the form closes. */
const SENT_MS = 900;

type Props = {
  page: string;
  appVersion: string;
  port: FeedbackPort;
  /** Distance from the bottom of the screen (above the box). */
  bottom: number;
};

type Phase = 'idle' | 'sending' | 'sent' | 'error';

export default function FeedbackButton({ page, appVersion, port, bottom }: Props) {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState<FeedbackTag>('broken');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // One id per opened form: a retry reuses it, so the server never saves the report twice.
  const reportId = useRef('');
  // Counts each opened form. A send that answers after its form was closed and reopened is ignored.
  const formNo = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const openForm = () => {
    formNo.current += 1;
    reportId.current = port.newId();
    setTag('broken');
    setMessage('');
    setPhase('idle');
    setError('');
    setOpen(true);
  };

  const send = async () => {
    if (!canSendFeedback(message) || phase === 'sending') return;
    const mine = formNo.current;
    const draft: FeedbackDraft = { id: reportId.current, tag, message: message.trim(), page, appVersion };
    setPhase('sending');
    setError('');
    try {
      await port.send(draft);
      if (mine !== formNo.current) return;
      setPhase('sent');
      timer.current = setTimeout(() => setOpen(false), SENT_MS);
    } catch (e) {
      if (mine !== formNo.current) return;
      setPhase('error');
      setError(e instanceof Error ? e.message : 'The report could not be sent.');
    }
  };

  const canSend = canSendFeedback(message) && phase !== 'sending' && phase !== 'sent';

  return (
    <>
      {!open && (
        <Pressable
          onPress={openForm}
          accessibilityRole="button"
          accessibilityLabel="Send feedback"
          style={({ pressed }) => [styles.button, { bottom }, pressed && styles.pressed]}
        >
          <Icon name="message-square" size={22} color={C.accent} />
        </Pressable>
      )}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        label="Send feedback"
        header={
          <View style={styles.head}>
            <Text style={T.headline}>Send feedback</Text>
            <Text style={[T.callout, { color: C.text2 }]} numberOfLines={2}>
              Page: {page}
            </Text>
          </View>
        }
        footer={
          phase === 'sent' ? (
            <Text style={[T.headline, styles.sent]} accessibilityLiveRegion="polite">
              Sent
            </Text>
          ) : (
            <View style={styles.actions}>
              <Button label="Cancel" kind="secondary" onPress={() => setOpen(false)} style={styles.half} />
              <Button label="Send" onPress={send} busy={phase === 'sending'} disabled={!canSend} style={styles.half} />
            </View>
          )
        }
      >
        <View style={styles.form}>
          <Text style={T.caption}>Type</Text>
          <Segmented<FeedbackTag> options={FEEDBACK_TAGS} value={tag} onChange={setTag} />
          <Field
            label="Message"
            value={message}
            onChange={(v) => setMessage(v.slice(0, MAX_FEEDBACK_MESSAGE))}
            multiline
            placeholder="What happened, or what would help?"
            hint={`${message.trim().length}/${MAX_FEEDBACK_MESSAGE}`}
          />
          {phase === 'error' && <Banner text={error} tone="danger" icon="alert-circle" />}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: S.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.line,
  },
  pressed: { opacity: 0.7 },
  head: { gap: S.xs, paddingBottom: S.sm },
  form: { gap: S.md },
  actions: { flexDirection: 'row', gap: S.md },
  half: { flex: 1 },
  sent: { color: C.ok, textAlign: 'center', paddingVertical: S.md },
});
