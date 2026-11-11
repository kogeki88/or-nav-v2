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
  supabase,
  watchSignedInUser,
} from './src/auth/supabase';
import { DEMO_USER_ID, demoSource } from './src/core/library/demoSource';
import DepartmentSheet from './src/features/library/DepartmentSheet';
import LibraryScreen from './src/features/library/LibraryScreen';
import LibrarySheet, { Selection } from './src/features/library/LibrarySheet';
import { makeCaseStore, memoryCaseRows } from './src/core/cases/caseStore';
import { makeCaseLearning } from './src/core/cases/learn';
import CaseSheet from './src/features/case/CaseSheet';
import { sqliteCaseStore } from './src/core/cases/sqliteCases';
import { useCases } from './src/features/case/useCases';
import { ShellState, firstName, timeGreeting } from './src/features/shell/logic';
import NameSheet from './src/features/shell/NameSheet';
import Shell from './src/features/shell/Shell';
import { COMPOSER_SPACE, Composer, OneBoxBody } from './src/omnibar/OneBox';
import { useOmnibar } from './src/omnibar/useOmnibar';
import { departmentLabel, toReview } from './src/features/library/logic';
import { supabaseAssistant } from './src/core/assistant/supabaseAssistant';
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
/** How a case learns its card (opening a card, or words that name one). Built once. */
const caseLearning = makeCaseLearning(wordSearch);
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
  const assistant = useMemo(() => supabaseAssistant(supabase), []);
  const caseStore = useMemo(() => (DEMO ? makeCaseStore(memoryCaseRows()) : sqliteCaseStore(user.id)), [user.id]);
  const cases = useCases(caseStore, caseLearning);
  const omni = useOmnibar(lib, assistant, cases.thread);
  const [nameOpen, setNameOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  // The one box: its text, this department's search index, and the item or card open in the sheet.
  const [text, setText] = useState('');
  const deptItems = useMemo(() => lib.data.items.filter((i) => i.department_id === lib.deptId), [lib.data.items, lib.deptId]);
  const deptCards = useMemo(() => lib.data.cards.filter((c) => c.department_id === lib.deptId), [lib.data.cards, lib.deptId]);
  const index = useMemo(() => wordSearch.index(deptItems, deptCards), [deptItems, deptCards]);
  const [selection, setSelection] = useState<Selection | null>(null);

  const { learnText, learnCard, setByHand } = cases;
  const send = useCallback(async () => {
    const value = text;
    // The case learns a card from the words sent (quietly), then the message goes to the AI.
    learnText(value, deptCards);
    // Clear the box only when the message went out and the nurse has not typed something new.
    if (await omni.send(value)) setText((cur) => (cur === value ? '' : cur));
  }, [omni, text, learnText, deptCards]);

  // The card the case knows (opened, learned or set by hand): a line at the top of the conversation.
  const knownCard = cases.current?.cardId ? lib.data.cards.find((c) => c.id === cases.current?.cardId) : undefined;
  const caseCard = knownCard
    ? { id: knownCard.id, title: knownCard.procedure, count: lib.data.cardItems.filter((ci) => ci.card_id === knownCard.id).length }
    : null;

  const isAdmin = user.role === 'admin';
  const person = { name: firstName(profile), fullName: profile.full_name, emoji: profile.avatar_emoji, role: profile.role };
  const department = lib.deptId ? departmentLabel(lib.data, lib.deptId).split(' · ').pop() ?? '' : 'Choose';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Shell
        state={shell}
        onChange={setShell}
        caseName={cases.label}
        caseKnown={cases.known}
        caseLearned={cases.learned}
        onCaseLabel={() => setCaseOpen(true)}
        cases={cases.list}
        onCase={cases.switchTo}
        onNewCase={cases.startNew}
        waiting={toReview(lib.data, user.id).length}
        person={person}
        onPerson={() => setNameOpen(true)}
        body={
          <OneBoxBody
            omni={omni}
            lib={lib}
            index={index}
            text={text}
            greeting={timeGreeting(new Date(), person.name)}
            notice={welcome !== '' ? <Text style={[T.callout, styles.welcome]}>{welcome}</Text> : null}
            onOpen={setSelection}
            onGoTo={(t) => {
              if (t === 'me') setNameOpen(true);
              else setShell({ view: t, sidebar: false });
            }}
            pickUp={cases.pickUp}
            onPickUp={cases.switchTo}
            caseCard={caseCard}
          />
        }
        composer={<Composer text={text} onChangeText={setText} onSend={send} busy={omni.busy} />}
        composerHeight={COMPOSER_SPACE}
        library={(header) => (
          <LibraryScreen
            lib={lib}
            search={wordSearch}
            topInset={0}
            bottomSpace={insets.bottom}
            jobRole={profile.role}
            header={header}
            onCardShown={(id) => {
              const card = lib.data.cards.find((c) => c.id === id);
              if (card) learnCard(card);
            }}
          />
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
      <CaseSheet
        open={caseOpen}
        onClose={() => setCaseOpen(false)}
        cards={deptCards}
        search={index}
        currentCardId={cases.current?.cardId ?? null}
        known={cases.known}
        onPick={(card) => {
          setByHand(card);
          setCaseOpen(false);
        }}
        onClear={() => {
          setByHand(null);
          setCaseOpen(false);
        }}
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
      {/* Items and cards tapped in the one box open here, over the main screen. */}
      <LibrarySheet
        lib={lib}
        selection={selection}
        onSelect={setSelection}
        onClose={() => setSelection(null)}
        onCardShown={(id) => {
          const card = lib.data.cards.find((c) => c.id === id);
          if (card) learnCard(card);
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
