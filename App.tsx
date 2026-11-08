import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from './src/auth/LoginScreen';
import {
  SignedInUser,
  readSignedInUser,
  refreshSignedInUser,
  watchSignedInUser,
} from './src/auth/supabase';
import { DEMO_USER_ID, demoSource } from './src/library/demoSource';
import LibraryScreen from './src/library/LibraryScreen';
import { toReview } from './src/library/logic';
import { supabaseSource } from './src/library/supabaseSource';
import { useLibrary } from './src/library/useLibrary';
import { greeting } from './src/profile/ProfileCard';
import Questionnaire from './src/profile/Questionnaire';
import type { ProfileRow } from './src/profile/profile';
import { loadProfile, saveProfile } from './src/profile/profileStore';
import ReviewScreen from './src/review/ReviewScreen';
import { C, S, T } from './src/theme';
import TabBar, { TAB_BAR_HEIGHT, TabName } from './src/ui/TabBar';
import { checkForUpdate, downloadAndInstall } from './src/updater';
import AdminView from './src/views/AdminView';
import RegularView from './src/views/RegularView';
import UpdatePanel, { UpdatePhase, UpdateState } from './src/views/UpdatePanel';
import ViewToggle, { ViewName, readSavedView, saveView } from './src/views/ViewToggle';

/** Demo mode: sample data, no sign-in. Only in a development run started with EXPO_PUBLIC_DEMO=1. */
const DEMO = __DEV__ && process.env.EXPO_PUBLIC_DEMO === '1';
const DEMO_USER: SignedInUser = { id: DEMO_USER_ID, email: 'demo@example.invalid', role: 'admin' };
const DEMO_PROFILE: ProfileRow = {
  full_name: 'Demo Nurse',
  nickname: 'Demo',
  facility: 'Sample General Hospital',
  department: 'CVOR / Cardiac OR',
  role: 'Scrub nurse',
  avatar_emoji: '🫀',
  favorite_specialty: 'Cardiac',
  years_in_or: '3-10',
  walkup_song: null,
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [remoteTag, setRemoteTag] = useState('—');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [user, setUser] = useState<SignedInUser | null>(() => (DEMO ? DEMO_USER : readSignedInUser()));
  // undefined = still loading; null = needs the questionnaire
  const [profile, setProfile] = useState<ProfileRow | null | undefined>(DEMO ? DEMO_PROFILE : undefined);
  const [previewing, setPreviewing] = useState(false);
  const [welcome, setWelcome] = useState('');

  const userId = user?.id;
  useEffect(() => {
    if (DEMO) return;
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
  useEffect(() => (DEMO ? undefined : watchSignedInUser(setUser)), []);
  useEffect(() => {
    if (DEMO) return;
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

  if (user && profile && !previewing) {
    return (
      <SignedIn
        user={user}
        profile={profile}
        update={update}
        welcome={welcome}
        onPreviewQuestionnaire={() => {
          setWelcome('');
          setPreviewing(true);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Text style={styles.title}>OR-Nav</Text>
          <Text style={styles.subtitle}>{user ? greeting(profile ?? null, user.email) : 'Operating room assistant'}</Text>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SignedIn({
  user,
  profile,
  update,
  welcome,
  onPreviewQuestionnaire,
}: {
  user: SignedInUser;
  profile: ProfileRow;
  update: UpdateState;
  welcome: string;
  onPreviewQuestionnaire: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabName>('library');
  const [view, setView] = useState<ViewName>(readSavedView);
  const source = useMemo(() => (DEMO ? demoSource() : supabaseSource(user.id)), [user.id]);
  const lib = useLibrary(source, user.id, !DEMO);
  const isAdmin = user.role === 'admin';
  const shownView: ViewName = isAdmin ? view : 'regular';

  // Tab content fills the whole screen and is drawn after the tab bar, so an open sheet's
  // dim layer covers the tab bar too. Lists pad their bottom by the tab bar's height.
  const tabBarSpace = TAB_BAR_HEIGHT + Math.max(insets.bottom, S.sm);
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.tabBar}>
        <TabBar value={tab} onChange={setTab} badge={toReview(lib.data, user.id).length} bottomInset={insets.bottom} />
      </View>
      <View style={styles.tabContent} pointerEvents="box-none">
        {tab === 'library' && <LibraryScreen lib={lib} topInset={insets.top} bottomSpace={tabBarSpace} jobRole={profile.role} />}
        {tab === 'review' && <ReviewScreen lib={lib} topInset={insets.top} bottomSpace={tabBarSpace} />}
        {tab === 'me' && (
          <ScrollView style={{ flex: 1, marginBottom: tabBarSpace }} contentContainerStyle={[styles.me, { paddingTop: insets.top + S.lg }]}>
            <Text style={T.largeTitle} accessibilityRole="header">
              Me
            </Text>
            <Text style={styles.subtitle}>{greeting(profile, user.email)}</Text>
            {welcome !== '' && <Text style={styles.welcome}>{welcome}</Text>}
            {isAdmin && (
              <ViewToggle
                value={shownView}
                onChange={(v) => {
                  setView(v);
                  saveView(v);
                }}
              />
            )}
            {shownView === 'regular' ? (
              <RegularView update={update} profile={profile} />
            ) : (
              <AdminView user={user} update={update} profile={profile} onPreviewQuestionnaire={onPreviewQuestionnaire} />
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    gap: 24,
  },
  top: { gap: 12 },
  title: { color: C.text, fontSize: 34, fontWeight: '700' },
  subtitle: { color: C.text2, fontSize: 18 },
  welcome: { color: C.ok, fontSize: 16 },
  bottom: { gap: 16 },
  me: { paddingHorizontal: S.lg, paddingBottom: S.xxl, gap: S.lg },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Full screen and drawn after the tab bar. Lists stop above the bar (marginBottom), so the
  // bar stays tappable; an open sheet is absolute and covers everything, bar included.
  tabContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
