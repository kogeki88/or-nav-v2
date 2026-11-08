import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RemoteRelease,
  checkForUpdate,
  downloadAndInstall,
  installedBuild,
  installedVersion,
} from './src/updater';

// OR Dark Mode palette (Master Plan, section 3)
const C = {
  bg: '#0B0F19',
  card: '#111827',
  accent: '#38BDF8',
  text: '#F8FAFC',
  muted: '#94A3B8',
  danger: '#F87171',
};

type Phase = 'idle' | 'checking' | 'downloading';

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [remoteTag, setRemoteTag] = useState('—');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [progress, setProgress] = useState(0);

  const runUpdate = useCallback(async () => {
    setIsError(false);
    setPhase('checking');
    setStatus('Checking GitHub for a new version…');
    try {
      const check = await checkForUpdate();
      setRemoteTag(check.remote.tag);
      if (!check.updateAvailable) {
        setStatus('You have the latest version.');
        setPhase('idle');
        return;
      }
      await install(check.remote);
    } catch (e) {
      setIsError(true);
      setStatus(e instanceof Error ? e.message : String(e));
      setPhase('idle');
    }
  }, []);

  const install = async (release: RemoteRelease) => {
    setPhase('downloading');
    setProgress(0);
    setStatus(`Downloading ${release.tag}…`);
    await downloadAndInstall(release, setProgress);
    setStatus('Opening the Android installer. Tap Update to finish.');
    setPhase('idle');
  };

  useEffect(() => {
    runUpdate();
  }, [runUpdate]);

  const busy = phase !== 'idle';
  const pct = Math.round(progress * 100);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Text style={styles.title}>OR-Nav</Text>
        <Text style={styles.subtitle}>Native shell · Brick 1</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.card}>
          <Row label="Installed Version" value={installedVersion()} />
          <Row label="Build Number" value={installedBuild()} />
          <Row label="Remote Tag" value={remoteTag} />
        </View>

        {phase === 'downloading' && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>{pct}%</Text>
          </View>
        )}

        {status !== '' && (
          <Text style={[styles.status, isError && { color: C.danger }]}>{status}</Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={runUpdate}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonDim]}
        >
          <Text style={styles.buttonText}>
            {phase === 'checking'
              ? 'Checking…'
              : phase === 'downloading'
                ? `Downloading ${pct}%`
                : 'Check for Updates'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  top: { gap: 4 },
  title: { color: C.text, fontSize: 34, fontWeight: '700' },
  subtitle: { color: C.muted, fontSize: 16 },
  bottom: { gap: 16 },
  card: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  rowLabel: { color: C.muted, fontSize: 17 },
  rowValue: { color: C.text, fontSize: 19, fontWeight: '600' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.card, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.accent },
  progressText: { color: C.text, fontSize: 16, width: 48, textAlign: 'right' },
  status: { color: C.muted, fontSize: 16, textAlign: 'center' },
  button: {
    minHeight: 60,
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: C.bg, fontSize: 19, fontWeight: '700' },
});
