// Admin test & diagnostics. Display only: anything powerful added here later must also be
// checked on the server (RLS on auth.jwt() -> 'app_metadata' ->> 'role').
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ConnectionState, SignedInUser, checkConnection, signOut, supabaseHost } from '../auth/supabase';
import ProfileCard from '../profile/ProfileCard';
import type { ProfileRow } from '../profile/profile';
import { C, S } from '../theme';
import { Button, DetailRow, Group, SectionLabel } from '../ui/kit';
import { installedBuild, installedVersion } from '../updater';
import UpdatePanel, { UpdateState } from './UpdatePanel';

const CONNECTION_LABEL: Record<ConnectionState | 'checking', { text: string; color: string }> = {
  checking: { text: 'Checking…', color: C.text2 },
  ok: { text: 'Connected', color: C.ok },
  offline: { text: 'Offline', color: C.danger },
  paused: { text: 'Paused — resume in Supabase', color: C.danger },
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
    <View>
      <SectionLabel text="App" />
      <Group style={{ paddingHorizontal: S.lg }}>
        <DetailRow first icon="phone-portrait-outline" label="Installed" value={installedVersion()} />
        <DetailRow icon="construct-outline" label="Build" value={installedBuild()} />
        <DetailRow icon="cloud-download-outline" label="Latest on GitHub" value={update.remoteTag} />
      </Group>

      <SectionLabel text="Account" />
      <Group style={{ paddingHorizontal: S.lg }}>
        <DetailRow first icon="mail-outline" label="Email" value={user.email} middle />
        <DetailRow icon="shield-checkmark-outline" label="Role" value={user.role} />
        <DetailRow icon="finger-print-outline" label="User ID" value={user.id} middle />
        <DetailRow icon="hourglass-outline" label="Session ends" value={formatExpiry(user.sessionExpiresAt)} />
        <DetailRow icon="server-outline" label="Server" value={supabaseHost || 'not set'} middle />
        <DetailRow icon="pulse-outline" label="Connection" value={conn.text} color={conn.color} />
      </Group>

      <View style={{ gap: S.md, marginTop: S.lg }}>
        <Button kind="secondary" icon="pulse-outline" label="Check connection" busy={connection === 'checking'} onPress={runCheck} />
        <Button kind="secondary" icon="eye-outline" label="Preview setup questions" onPress={onPreviewQuestionnaire} />
      </View>

      {profile && <ProfileCard profile={profile} />}

      <View style={{ gap: S.md, marginTop: S.xl }}>
        <UpdatePanel update={update} primary={false} />
        <Button kind="ghost" tone="danger" icon="log-out-outline" label="Sign out" onPress={signOut} />
      </View>
    </View>
  );
}
