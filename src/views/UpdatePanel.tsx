// Status line, progress bar and Check for Updates button. Shared by Sign in, Regular and Admin views,
// so an update can always be installed, whatever screen is showing.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, ui } from '../theme';

export type UpdatePhase = 'idle' | 'checking' | 'downloading';

export type UpdateState = {
  phase: UpdatePhase;
  progress: number;
  status: string;
  isError: boolean;
  remoteTag: string;
  run: () => void;
};

export default function UpdatePanel({ update, primary }: { update: UpdateState; primary: boolean }) {
  const busy = update.phase !== 'idle';
  const pct = Math.round(update.progress * 100);
  return (
    <View style={styles.wrap}>
      {update.phase === 'downloading' && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>{pct}%</Text>
        </View>
      )}

      {update.status !== '' && (
        <Text style={[styles.status, update.isError && { color: C.danger }]}>{update.status}</Text>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={update.run}
        style={({ pressed }) => [primary ? ui.primary : ui.secondary, (pressed || busy) && ui.dim]}
      >
        <Text style={primary ? ui.primaryText : ui.secondaryText}>
          {update.phase === 'checking'
            ? 'Checking…'
            : update.phase === 'downloading'
              ? `Downloading ${pct}%`
              : 'Check for Updates'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.card, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.accent },
  progressText: { color: C.text, fontSize: 16, width: 48, textAlign: 'right' },
  status: { color: C.muted, fontSize: 16, textAlign: 'center' },
});
