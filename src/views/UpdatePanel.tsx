// Status line, progress bar and "Check for updates" button. Shared by sign-in and the Me tab,
// so an update can always be installed, whatever screen is showing.
import { Text, View } from 'react-native';

import { C, S, T } from '../theme';
import { Button, ProgressBar } from '../ui/kit';

export type UpdatePhase = 'idle' | 'checking' | 'downloading';

export type UpdateState = {
  phase: UpdatePhase;
  progress: number;
  status: string;
  isError: boolean;
  remoteTag: string;
  run: () => void;
};

/** quiet: a text-only button, for screens whose main action is something else (sign-in). */
export default function UpdatePanel({ update, primary, quiet }: { update: UpdateState; primary: boolean; quiet?: boolean }) {
  const busy = update.phase !== 'idle';
  const pct = Math.round(update.progress * 100);
  return (
    <View style={{ gap: S.md }}>
      {update.phase === 'downloading' && <ProgressBar value={update.progress} />}

      {update.status !== '' && (
        <Text style={[T.callout, { textAlign: 'center' }, update.isError && { color: C.danger }]} accessibilityLiveRegion="polite">
          {update.status}
        </Text>
      )}

      <Button
        kind={quiet ? 'ghost' : primary ? 'primary' : 'secondary'}
        icon={busy ? undefined : 'refresh-cw'}
        disabled={busy}
        onPress={update.run}
        label={update.phase === 'checking' ? 'Checking…' : update.phase === 'downloading' ? `Downloading ${pct}%` : 'Check for updates'}
      />
    </View>
  );
}
