// Admin test & diagnostics. Display only: anything powerful added here later must also be
// checked on the server (RLS on auth.jwt() -> 'app_metadata' ->> 'role').
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConnectionState, SignedInUser, checkConnection, signOut, supabaseHost } from '../auth/supabase';
import ProfileCard from '../profile/ProfileCard';
import type { ProfileRow } from '../profile/profile';
import { installedBuild, installedVersion } from '../updater';
import { C, ui } from '../theme';
import Row from './Row';
import UpdatePanel, { UpdateState } from './UpdatePanel';

const CONNECTION_LABEL: Record<ConnectionState | 'checking', { text: string; color: string }> = {
  checking: { text: 'Checking…', color: C.muted },
  ok: { text: 'OK', color: C.ok },
  offline: { text: 'Offline', color: C.danger },
  paused: { text: 'Paused – Resume in Supabase', color: C.danger },
  error: { text: 'Error', color: C.danger },
};

function formatExpiry(seconds?: number): string {
  if (!seconds) return '—';
  const d = new Date(seconds * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

type Props = {
  user: SignedInUser;
  update: UpdateState;
  profile: ProfileRow | null;
  onPreviewQuestionnaire: () => void;
};

export default function AdminView({ user, update, profile, onPreviewQuestionnaire }: Props) {
  const [connection, setConnection] = useState<ConnectionState | 'checking'>('checking');

  const runCheck = useCallback(async () => {
    setConnection('checking');
    setConnection(await checkConnection());
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const conn = CONNECTION_LABEL[connection];

  return (
    <View style={styles.wrap}>
      <View style={ui.card}>
        <Row label="Installed Version" value={installedVersion()} />
        <Row label="Build Number" value={installedBuild()} />
        <Row label="Remote Tag" value={update.remoteTag} />
      </View>

      <View style={ui.card}>
        <Row label="Account" value={user.email} />
        <Row label="Role" value={user.role} />
        <Row label="User ID" value={user.id} />
        <Row label="Session expires" value={formatExpiry(user.sessionExpiresAt)} />
        <Row label="Supabase" value={supabaseHost || 'not set'} />
        <Row label="Connection" value={conn.text} color={conn.color} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={runCheck}
        disabled={connection === 'checking'}
        style={({ pressed }) => [ui.secondary, (pressed || connection === 'checking') && ui.dim]}
      >
        <Text style={ui.secondaryText}>Check connection</Text>
      </Pressable>

      {profile && <ProfileCard profile={profile} />}

      <Pressable accessibilityRole="button" onPress={onPreviewQuestionnaire} style={ui.secondary}>
        <Text style={ui.secondaryText}>Preview questionnaire</Text>
      </Pressable>

      <UpdatePanel update={update} primary />

      <Pressable accessibilityRole="button" onPress={signOut} style={ui.secondary}>
        <Text style={ui.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
});
