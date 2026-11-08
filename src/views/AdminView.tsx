// Admin test & diagnostics. Display only: anything powerful added here later must also be
// checked on the server (RLS on auth.jwt() -> 'app_metadata' ->> 'role').
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { DbHealth, dbHealth } from '../db/libraryStore';
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

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

  const [db, setDb] = useState<DbHealth | null>(null);
  const [dbError, setDbError] = useState('');

  const runCheck = useCallback(async () => {
    setConnection('checking');
    setConnection(await checkConnection());
    try {
      setDb(await dbHealth());
      setDbError('');
    } catch (e) {
      setDbError(e instanceof Error ? e.message : String(e));
    }
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

      <SectionLabel text="Phone database" />
      <Group style={{ paddingHorizontal: S.lg }}>
        {dbError ? (
          <DetailRow first icon="alert-circle-outline" label="Error" value={dbError} color={C.danger} />
        ) : (
          <>
            <DetailRow
              first
              icon="layers-outline"
              label="Schema"
              value={db ? `v${db.schemaVersion} of v${db.latestVersion}` : '…'}
              color={db && db.schemaVersion !== db.latestVersion ? C.danger : undefined}
            />
            <DetailRow icon="business-outline" label="Your departments" value={db ? String(db.counts.departments) : '…'} />
            <DetailRow icon="document-text-outline" label="Cards" value={db ? String(db.counts.cards) : '…'} />
            <DetailRow icon="cube-outline" label="Items" value={db ? String(db.counts.items) : '…'} />
            <DetailRow icon="list-outline" label="Card lines" value={db ? String(db.counts.cardItems) : '…'} />
            <DetailRow icon="git-pull-request-outline" label="Suggestions" value={db ? String(db.counts.requests) : '…'} />
            <DetailRow icon="save-outline" label="File size" value={db ? formatBytes(db.sizeBytes) : '…'} />
            <DetailRow icon="time-outline" label="Last sync" value={db ? formatWhen(db.loadedAt) : '…'} />
          </>
        )}
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
