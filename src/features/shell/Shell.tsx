// The signed-in shell: one main screen with a top bar (☰, case label, new case) and the box at
// the bottom; the sidebar; and Library, To review and Admin tools as full-screen views over it.
// Screens from other features come in from App.tsx as ready-made pieces (a feature never imports another).
import { ReactNode, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CaseListRow } from '../../contracts/cases';
import { C, S } from '../../theme';
import { IconButton } from '../../ui/kit';
import CaseLabel from './CaseLabel';
import { ShellState, backStep, sidebarRows } from './logic';
import Sidebar from './Sidebar';

export const TOP_BAR_HEIGHT = 56;

type Props = {
  state: ShellState;
  onChange: (s: ShellState) => void;
  caseName: string;
  /** The case knows its surgeon or procedure: the label sits on a fill with a breathing dot. */
  caseKnown: boolean;
  /** Goes up each time the case learns by itself (the label plays its ring once). */
  caseLearned: number;
  /** A tap on the case label: the sheet to change the case. */
  onCaseLabel: () => void;
  /** Recent cases for the sidebar, the current one marked. */
  cases: CaseListRow[];
  onCase: (caseId: string) => void;
  onNewCase: () => void;
  /** Suggestions waiting for this nurse's review: the To review row and the dot on ☰. */
  waiting: number;
  person: { name: string; fullName: string; emoji: string | null };
  onPerson: () => void;
  /** Main screen content between the top bar and the box. */
  body: ReactNode;
  /** The box at the bottom (with its own bottom padding). */
  composer: ReactNode;
  composerHeight: number;
  /** Full-screen views. Library takes the back bar as its header, so its sheets cover it too. */
  library: (header: ReactNode) => ReactNode;
  review: ReactNode;
  admin: ReactNode;
};

export default function Shell({ state, onChange, caseName, caseKnown, caseLearned, onCaseLabel, cases, onCase, onNewCase, waiting, person, onPerson, body, composer, composerHeight, library, review, admin }: Props) {
  const insets = useSafeAreaInsets();
  const live = useRef({ state, onChange });
  live.current = { state, onChange };

  // Android Back: close the sidebar, then the full-screen view. An open sheet's own handler runs first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const next = backStep(live.current.state);
      if (!next) return false;
      live.current.onChange(next);
      return true;
    });
    return () => sub.remove();
  }, [state.view, state.sidebar]);

  // Keep the box above the keyboard. In edge-to-edge mode Android does not shrink the window, so the
  // keyboard's top edge (from its event) is compared with this screen's own height (measured below).
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboardTop(e.endCoordinates.screenY));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const keyboard = keyboardTop !== null && frame > 0 ? frame - keyboardTop : 0;
  const composerBottom = Math.max(insets.bottom, keyboard);

  const set = (patch: Partial<ShellState>) => onChange({ ...state, ...patch });
  const goBack = () => set({ view: 'main' });

  const backBar = (title: string) => (
    <View style={[styles.backBar, { paddingTop: insets.top, height: insets.top + TOP_BAR_HEIGHT }]}>
      <IconButton name="arrow-left" label={`Back from ${title}`} onPress={goBack} bg="transparent" color={C.text} />
    </View>
  );

  return (
    <View style={styles.screen} onLayout={(e) => setFrame(e.nativeEvent.layout.height)}>
      <View style={[styles.topBar, { paddingTop: insets.top, height: insets.top + TOP_BAR_HEIGHT }]}>
        <View>
          <IconButton name="menu" label={waiting ? `Open the sidebar. ${waiting} to review` : 'Open the sidebar'} onPress={() => set({ sidebar: true })} bg="transparent" color={C.text} />
          {waiting > 0 && <View style={styles.dot} pointerEvents="none" />}
        </View>
        <CaseLabel label={caseName} known={caseKnown} learned={caseLearned} onPress={onCaseLabel} />
        <IconButton name="edit" label="New case" onPress={onNewCase} bg="transparent" color={C.text} />
      </View>

      <View style={styles.body}>{body}</View>
      <View style={{ paddingBottom: composerBottom }}>{composer}</View>

      <Sidebar
        open={state.sidebar}
        onOpen={() => set({ sidebar: true })}
        onClose={() => set({ sidebar: false })}
        rows={sidebarRows(waiting)}
        onRow={(key) => {
          onChange({ sidebar: false, view: key === 'new' ? 'main' : key });
          if (key === 'new') onNewCase();
        }}
        cases={cases}
        onCase={(id) => {
          onChange({ sidebar: false, view: 'main' });
          onCase(id);
        }}
        person={person}
        onPerson={() => {
          set({ sidebar: false });
          onPerson();
        }}
        edgeTop={insets.top + TOP_BAR_HEIGHT}
        edgeBottom={insets.bottom + composerHeight}
      />

      {state.view !== 'main' && (
        <View style={[StyleSheet.absoluteFill, styles.view]}>
          {state.view === 'library' && library(backBar('Library'))}
          {state.view === 'review' && (
            <>
              {backBar('To review')}
              {review}
            </>
          )}
          {state.view === 'admin' && (
            <>
              {backBar('Admin tools')}
              {admin}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.xs, backgroundColor: C.bg },
  dot: { position: 'absolute', top: 12, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.warn },
  body: { flex: 1 },
  backBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.xs, backgroundColor: C.bg },
  view: { backgroundColor: C.bg },
});
