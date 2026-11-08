import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import LoginScreen from './src/auth/LoginScreen';
import {
  SignedInUser,
  readSignedInUser,
  refreshSignedInUser,
  watchSignedInUser,
} from './src/auth/supabase';
import { greeting } from './src/profile/ProfileCard';
import Questionnaire from './src/profile/Questionnaire';
import type { ProfileRow } from './src/profile/profile';
import { loadProfile, saveProfile } from './src/profile/profileStore';
import { C } from './src/theme';
import { checkForUpdate, downloadAndInstall } from './src/updater';
import AdminView from './src/views/AdminView';
import RegularView from './src/views/RegularView';
import UpdatePanel, { UpdatePhase, UpdateState } from './src/views/UpdatePanel';
import ViewToggle, { ViewName, readSavedView, saveView } from './src/views/ViewToggle';

export default function App() {
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [remoteTag, setRemoteTag] = useState('—');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [user, setUser] = useState<SignedInUser | null>(readSignedInUser);
  const [view, setView] = useState<ViewName>(readSavedView);
  // undefined = still loading; null = needs the questionnaire
  const [profile, setProfile] = useState<ProfileRow | null | undefined>(undefined);
  const [previewing, setPreviewing] = useState(false);
  const [welcome, setWelcome] = useState('');

  const userId = user?.id;
  useEffect(() => {
    setProfile(undefined);
    setPreviewing(false);
    if (!userId) return;
    let live = true;
    loadProfile(userId).then((p) => live && setProfile(p));
    return () => {
      live = false;
    };
  }, [userId]);

  const finishQuestionnaire = async (row: ProfileRow) => {
    if (!userId) return;
    const synced = await saveProfile(userId, row);
    setProfile(row);
    setWelcome(
      synced
        ? `Welcome, ${row.nickname}! You're all set.`
        : `Welcome, ${row.nickname}! Saved on this phone; it will sync when you're online.`,
    );
  };

  // Account: follow Supabase events, and ask the server for the latest role on start and on return.
  useEffect(() => watchSignedInUser(setUser), []);
  useEffect(() => {
    const refresh = () => refreshSignedInUser().then((u) => u && setUser(u));
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, []);

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
      setPhase('downloading');
      setProgress(0);
      setStatus(`Downloading ${check.remote.tag}…`);
      await downloadAndInstall(check.remote, setProgress);
      setStatus('Opening the Android installer. Tap Update to finish.');
      setPhase('idle');
    } catch (e) {
      setIsError(true);
      setStatus(e instanceof Error ? e.message : String(e));
      setPhase('idle');
    }
  }, []);

  useEffect(() => {
    runUpdate();
  }, [runUpdate]);

  const update: UpdateState = { phase, progress, status, isError, remoteTag, run: runUpdate };
  const isAdmin = user?.role === 'admin';
  const shownView: ViewName = isAdmin ? view : 'regular';

  const changeView = (v: ViewName) => {
    setView(v);
    saveView(v);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Text style={styles.title}>OR-Nav</Text>
          <Text style={styles.subtitle}>
            {user ? greeting(profile ?? null, user.email) : 'Operating room assistant'}
          </Text>
          {isAdmin && profile && !previewing && <ViewToggle value={shownView} onChange={changeView} />}
          {welcome !== '' && <Text style={styles.welcome}>{welcome}</Text>}
        </View>

        <View style={styles.bottom}>
          {!user && (
            <>
              <LoginScreen />
              <UpdatePanel update={update} primary={false} />
            </>
          )}
          {user && profile === undefined && <ActivityIndicator color={C.accent} size="large" />}
          {user && profile === null && <Questionnaire onSave={finishQuestionnaire} onClose={() => {}} />}
          {user && !profile && <UpdatePanel update={update} primary={false} />}
          {user && profile && previewing && <Questionnaire preview onClose={() => setPreviewing(false)} />}
          {user && profile && !previewing && shownView === 'regular' && (
            <RegularView update={update} profile={profile} />
          )}
          {user && profile && !previewing && shownView === 'admin' && (
            <AdminView
              user={user}
              update={update}
              profile={profile}
              onPreviewQuestionnaire={() => {
                setWelcome('');
                setPreviewing(true);
              }}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
    justifyContent: 'space-between',
    gap: 24,
  },
  top: { gap: 12 },
  title: { color: C.text, fontSize: 34, fontWeight: '700' },
  subtitle: { color: C.muted, fontSize: 18 },
  welcome: { color: C.ok, fontSize: 16 },
  bottom: { gap: 16 },
});
