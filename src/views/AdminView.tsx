// Admin test & diagnostics. Display only: anything powerful added here later must also be
// checked on the server (RLS on auth.jwt() -> 'app_metadata' ->> 'role').
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { DbHealth, dbHealth } from '../db/libraryStore';
import { ConnectionState, SignedInUser, checkConnection, signOut, supabaseHost } from '../auth/supabase';
import { CheckResult, CheckStatus, FaultEntry, recentErrors } from '../diag/faultLog';
import { logFault, readFaults } from '../diag/faultStore';
import { runFullCheck, sendReport } from '../diag/fullCheck';
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

const CHECK_COLOR: Record<CheckStatus, string> = { ok: C.ok, warn: C.warn, fail: C.danger };
const CHECK_ICON = { ok: 'check-circle', warn: 'alert-circle', fail: 'x-circle' } as const;
const SHOWN_FAULTS = 20;

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

  const [faults, setFaults] = useState<FaultEntry[] | null>(null);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState<{ text: string; ok: boolean } | null>(null);

  const loadFaults = useCallback(async () => {
    try {
      setFaults(await readFaults());
    } catch {
      setFaults([]);
    }
  }, []);

  const fullCheck = useCallback(async () => {
    setChecking(true);
    setSendNote(null);
    try {
      setChecks(await runFullCheck(user.id));
    } finally {
      setChecking(false);
      loadFaults();
    }
  }, [user.id, loadFaults]);

  const send = useCallback(async () => {
    setSending(true);
    try {
      const entries = await readFaults();
      await sendReport(user.id, checks ?? [], entries);
      setSendNote({ text: `Sent: ${checks ? checks.length : 0} check lines, ${Math.min(entries.length, 200)} log entries.`, ok: true });
    } catch (e) {
      setSendNote({ text: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setSending(false);
    }
  }, [user.id, checks]);

  const testFault = useCallback(() => {
    logFault('test', new Error('Test fault from the Admin view'));
    setTimeout(loadFaults, 300);
  }, [loadFaults]);

  useEffect(() => {
    loadFaults();
  }, [loadFaults]);

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
        <DetailRow first icon="smartphone" label="Installed" value={installedVersion()} />
        <DetailRow icon="tool" label="Build" value={installedBuild()} />
        <DetailRow icon="download-cloud" label="Latest on GitHub" value={update.remoteTag} />
      </Group>

      <SectionLabel text="Account" />
      <Group style={{ paddingHorizontal: S.lg }}>
        <DetailRow first icon="mail" label="Email" value={user.email} middle />
        <DetailRow icon="shield" label="Role" value={user.role} />
        <DetailRow icon="key" label="User ID" value={user.id} middle />
        <DetailRow icon="watch" label="Session ends" value={formatExpiry(user.sessionExpiresAt)} />
        <DetailRow icon="server" label="Server" value={supabaseHost || 'not set'} middle />
        <DetailRow icon="activity" label="Connection" value={conn.text} color={conn.color} />
      </Group>

      <SectionLabel text="Phone database" />
      <Group style={{ paddingHorizontal: S.lg }}>
        {dbError ? (
          <DetailRow first icon="alert-circle" label="Error" value={dbError} color={C.danger} />
        ) : (
          <>
            <DetailRow
              first
              icon="layers"
              label="Schema"
              value={db ? `v${db.schemaVersion} of v${db.latestVersion}` : '…'}
              color={db && db.schemaVersion !== db.latestVersion ? C.danger : undefined}
            />
            <DetailRow icon="briefcase" label="Your departments" value={db ? String(db.counts.departments) : '…'} />
            <DetailRow icon="file-text" label="Cards" value={db ? String(db.counts.cards) : '…'} />
            <DetailRow icon="box" label="Items" value={db ? String(db.counts.items) : '…'} />
            <DetailRow icon="list" label="Card lines" value={db ? String(db.counts.cardItems) : '…'} />
            <DetailRow icon="git-pull-request" label="Suggestions" value={db ? String(db.counts.requests) : '…'} />
            <DetailRow icon="save" label="File size" value={db ? formatBytes(db.sizeBytes) : '…'} />
            <DetailRow icon="clock" label="Last sync" value={db ? formatWhen(db.loadedAt) : '…'} />
          </>
        )}
      </Group>

      <SectionLabel text="Fault log" right={faults ? `${faults.length} saved` : '…'} />
      <Group style={{ paddingHorizontal: S.lg }}>
        <DetailRow
          first
          icon="alert-octagon"
          label="Errors in 24 h"
          value={faults ? String(recentErrors(faults)) : '…'}
          color={faults ? (recentErrors(faults) ? C.danger : C.ok) : undefined}
        />
        {(faults ?? []).slice(0, SHOWN_FAULTS).map((f, i) => (
          <DetailRow
            key={`${f.at}-${i}`}
            icon={f.level === 'error' ? 'x-circle' : f.level === 'warn' ? 'alert-circle' : 'cloud-off'}
            label={`${formatWhen(f.at)} ${f.area}`}
            value={f.message}
            color={f.level === 'error' ? C.danger : f.level === 'warn' ? C.warn : C.text2}
          />
        ))}
      </Group>

      {checks && (
        <>
          <SectionLabel text="Full check" />
          <Group style={{ paddingHorizontal: S.lg }}>
            {checks.map((c, i) => (
              <DetailRow key={c.name} first={i === 0} icon={CHECK_ICON[c.status]} label={c.name} value={c.value} color={CHECK_COLOR[c.status]} />
            ))}
          </Group>
        </>
      )}

      <View style={{ gap: S.md, marginTop: S.lg }}>
        <Button kind="primary" icon="activity" label="Run full check" busy={checking} onPress={fullCheck} />
        <Button kind="secondary" icon="upload-cloud" label="Send report" busy={sending} onPress={send} />
        {sendNote && <Text style={{ color: sendNote.ok ? C.ok : C.danger, fontSize: 15, lineHeight: 20 }}>{sendNote.text}</Text>}
        {__DEV__ && <Button kind="ghost" icon="droplet" label="Add test fault" onPress={testFault} />}
      </View>

      <View style={{ gap: S.md, marginTop: S.lg }}>
        <Button kind="secondary" icon="activity" label="Check connection" busy={connection === 'checking'} onPress={runCheck} />
        <Button kind="secondary" icon="eye" label="Preview setup questions" onPress={onPreviewQuestionnaire} />
      </View>

      {profile && <ProfileCard profile={profile} />}

      <View style={{ gap: S.md, marginTop: S.xl }}>
        <UpdatePanel update={update} primary={false} />
        <Button kind="ghost" tone="danger" icon="log-out" label="Sign out" onPress={signOut} />
      </View>
    </View>
  );
}
