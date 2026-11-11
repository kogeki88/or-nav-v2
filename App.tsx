import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from './src/auth/LoginScreen';
import {
  SignedInUser,
  readSignedInUser,
  refreshSignedInUser,
  signOut,
  watchSignedInUser,
} from './src/auth/supabase';
import { DEMO_USER_ID, demoSource } from './src/core/library/demoSource';
import DepartmentSheet from './src/features/library/DepartmentSheet';
import LibraryScreen from './src/features/library/LibraryScreen';
import type { Selection } from './src/features/library/LibrarySheet';
import { ShellState, caseTimeName, firstName } from './src/features/shell/logic';
import NameSheet from './src/features/shell/NameSheet';
import Shell from './src/features/shell/Shell';
import OmniBar, { OMNI_BAR_SPACE } from './src/omnibar/OmniBar';
import OmniSheet from './src/omnibar/OmniSheet';
import { useOmnibar } from './src/omnibar/useOmnibar';
import { departmentLabel, toReview } from './src/features/library/logic';
import { supabaseSource } from './src/core/library/supabaseSource';
import { wordSearch } from './src/core/search/engine';
import { useLibrary } from './src/features/library/useLibrary';
import { greeting } from './src/profile/ProfileCard';
import Questionnaire from './src/profile/Questionnaire';
import type { ProfileRow } from './src/profile/profile';
import { loadProfile, saveProfile } from './src/profile/profileStore';
import ReviewScreen from './src/review/ReviewScreen';
import { C, F, S, T } from './src/theme';
import { IconTile } from './src/ui/kit';
import { startFaultCapture } from './src/diag/capture';
import { logFault } from './src/diag/faultStore';
import { checkForUpdate, downloadAndInstall, installedVersion } from './src/updater';
import AdminView from './src/views/AdminView';
import UpdatePanel, { UpdatePhase, UpdateState } from './src/views/UpdatePanel';

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

startFaultCapture();

export default function App() {
  // Manrope, one family with four weights (DESIGN.md). If it fails to load, the system font is used.
  const [fontsLoaded, fontError] = useFonts([
    {
      fontFamily: F,
      fontDefinitions: [
        { path: require('./assets/fonts/Manrope-Regular.ttf'), weight: 400 },
        { path: require('./assets/fonts/Manrope-Medium.ttf'), weight: 500 },
        { path: require('./assets/fonts/Manrope-SemiBold.ttf'), weight: 600 },
        { path: require('./assets/fonts/Manrope-Bold.ttf'), weight: 700 },
      ],
    },
  ]);
  useEffect(() => {
    if (fontError) logFault('crash', fontError, 'warn');
  }, [fontError]);
  if (!fontsLoaded && !fontError) return null;
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
  // Kept here so closing the setup-questions preview returns to the same view (Admin tools).
  const [shell, setShell] = useState<ShellState>({ view: 'main', sidebar: false });

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
      logFault('update', e);
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
        shell={shell}
        setShell={setShell}
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
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + S.xxl, paddingBottom: insets.bottom + S.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <View style={styles.brandRow}>
            <IconTile name="navigation" size={48} />
            <Text style={T.largeTitle}>OR-Nav</Text>
          </View>
          <Text style={[T.body, { color: C.text2 }]}>
            {user ? greeting(profile ?? null, user.email) : 'Preference cards and supply locations for your OR, even offline.'}
          </Text>
        </View>

        <View style={styles.bottom}>
          {!user && (
            <>
              <LoginScreen />
              <UpdatePanel update={update} primary={false} quiet />
            </>
          )}
          {user && profile === undefined && <ActivityIndicator color={C.accent} size="large" />}
          {user && profile === null && <Questionnaire onSave={finishQuestionnaire} onClose={() => {}} />}
          {user && !profile && <UpdatePanel update={update} primary={false} quiet />}
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
  shell,
  setShell,
  onPreviewQuestionnaire,
}: {
  user: SignedInUser;
  profile: ProfileRow;
  update: UpdateState;
  welcome: string;
  shell: ShellState;
  setShell: (s: ShellState) => void;
  onPreviewQuestionnaire: () => void;
}) {
  const insets = useSafeAreaInsets();
  const source = useMemo(() => (DEMO ? demoSource() : supabaseSource(user.id)), [user.id]);
  const lib = useLibrary(source, user.id, !DEMO);
  const omni = useOmnibar(lib);
  const [omniOpen, setOmniOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  // Until cases arrive (#14), the case is named by the time the app opened.
  const caseName = useMemo(() => caseTimeName(new Date()), []);
  // An item or card the assistant asked to open; the Library view opens it in its sheet.
  const [openRequest, setOpenRequest] = useState<{ selection: Selection; n: number } | null>(null);
  // Forget it once the Library view closes, so reopening Library does not reopen the old item.
  useEffect(() => {
    if (shell.view !== 'library') setOpenRequest(null);
  }, [shell.view]);

  const openSelection = useCallback(
    (selection: Selection) => {
      setOmniOpen(false);
      setShell({ view: 'library', sidebar: false });
      setOpenRequest((prev) => ({ selection, n: (prev?.n ?? 0) + 1 }));
    },
    [setShell],
  );

  const isAdmin = user.role === 'admin';
  const person = { name: firstName(profile), fullName: profile.full_name, emoji: profile.avatar_emoji, role: profile.role };
  const department = lib.deptId ? departmentLabel(lib.data, lib.deptId).split(' · ').pop() ?? '' : 'Choose';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Shell
        state={shell}
        onChange={setShell}
        caseName={caseName}
        waiting={toReview(lib.data, user.id).length}
        person={person}
        onPerson={() => setNameOpen(true)}
        body={welcome !== '' ? <Text style={[T.callout, styles.welcome]}>{welcome}</Text> : null}
        composer={<OmniBar onOpen={() => setOmniOpen(true)} busy={omni.busy} />}
        composerHeight={OMNI_BAR_SPACE}
        library={(header) => (
          <LibraryScreen lib={lib} search={wordSearch} topInset={0} bottomSpace={insets.bottom} jobRole={profile.role} openRequest={openRequest} header={header} />
        )}
        review={<ReviewScreen lib={lib} topInset={0} bottomSpace={insets.bottom} />}
        admin={
          <ScrollView contentContainerStyle={[styles.admin, { paddingBottom: insets.bottom + S.xxl }]}>
            <Text style={T.largeTitle} accessibilityRole="header">
              Admin tools
            </Text>
            <AdminView user={user} update={update} profile={profile} onPreviewQuestionnaire={onPreviewQuestionnaire} />
          </ScrollView>
        }
      />
      <NameSheet
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        person={person}
        isAdmin={isAdmin}
        department={department}
        version={installedVersion()}
        update={update}
        onDepartment={() => {
          setNameOpen(false);
          setDeptOpen(true);
        }}
        onAdmin={() => {
          setNameOpen(false);
          setShell({ view: 'admin', sidebar: false });
        }}
        onSignOut={signOut}
      />
      <DepartmentSheet lib={lib} open={deptOpen} onClose={() => setDeptOpen(false)} jobRole={profile.role} />
      <OmniSheet
        open={omniOpen}
        onClose={() => setOmniOpen(false)}
        omni={omni}
        lib={lib}
        onOpenSelection={openSelection}
        onGoTo={(t) => {
          setOmniOpen(false);
          if (t === 'me') setNameOpen(true);
          else setShell({ view: t, sidebar: false });
        }}
      />
      {/* Solid strip behind the status bar, so scrolled content never runs under the clock. */}
      <View pointerEvents="none" style={[styles.statusStrip, { height: insets.top }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: S.lg,
    justifyContent: 'space-between',
    gap: S.xl,
  },
  top: { gap: S.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  bottom: { gap: S.lg },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.bg },
  welcome: { color: C.ok, paddingHorizontal: S.lg, paddingTop: S.lg },
  admin: { paddingHorizontal: S.lg, gap: S.lg },
});
