// First sign-in questionnaire: 4 short steps. In preview mode (admin) nothing is saved.
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { C, F, R, S, T } from '../theme';
import { Banner, Button, Field, Icon, PressScale } from '../ui/kit';
import {
  DEPARTMENTS,
  Draft,
  EMOJIS,
  EMPTY_DRAFT,
  ProfileRow,
  ROLES,
  SPECIALTIES,
  STEP_COUNT,
  STEP_TITLES,
  YEARS,
  YEARS_LABEL,
  toRow,
  validateStep,
} from './profile';

type Props = {
  preview?: boolean;
  /** Saves the answers. Not called in preview mode. Returns a message to show, or null. */
  onSave?: (row: ProfileRow) => Promise<void>;
  onClose: () => void;
};

export default function Questionnaire({ preview = false, onSave, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field: keyof Draft) => (value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setProblem('');
  };

  const next = async () => {
    const issue = validateStep(step, draft);
    if (issue) {
      setProblem(issue);
      return;
    }
    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
      return;
    }
    if (preview || !onSave) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSave(toRow(draft));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const back = () => {
    setProblem('');
    setStep(step - 1);
  };

  // Android Back: previous step; on the first step of a preview, close the preview.
  // (On the first step of the real questions, Back leaves the app as usual.)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving) return true;
      if (step > 0) {
        setProblem('');
        setStep((s) => s - 1);
        return true;
      }
      if (preview) {
        onClose();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, preview, saving, onClose]);

  const last = step === STEP_COUNT - 1;

  return (
    <View style={styles.wrap}>
      {preview && <Banner text="Preview — answers are not saved." tone="accent" icon="eye" />}

      <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
        {STEP_TITLES.map((t, i) => (
          <View key={t} style={[styles.dot, i <= step && styles.dotOn]} />
        ))}
      </View>
      <View style={{ gap: S.xs }}>
        <Text style={T.caption}>
          Step {step + 1} of {STEP_COUNT}
        </Text>
        <Text style={T.title} accessibilityRole="header">
          {STEP_TITLES[step]}
        </Text>
      </View>

      {step === 0 && (
        <>
          <Field label="Your name" value={draft.fullName} onChange={set('fullName')} autoComplete="name" placeholder="First and last name" />
          <Field
            label="Nickname (optional)"
            hint="What OR-Nav calls you. Leave empty to use your first name."
            value={draft.nickname}
            onChange={set('nickname')}
          />
        </>
      )}

      {step === 1 && (
        <>
          <Field label="Facility" hint="Hospital or surgery center" value={draft.facility} onChange={set('facility')} />
          <Label text="Department" />
          <Chips options={DEPARTMENTS} value={draft.department} onChange={set('department')} />
          {draft.department === 'Other' && (
            <Field label="Your department" value={draft.departmentOther} onChange={set('departmentOther')} />
          )}
        </>
      )}

      {step === 2 && (
        <>
          <Chips options={ROLES} value={draft.role} onChange={set('role')} />
          {draft.role === 'Other' && <Field label="Your role" value={draft.roleOther} onChange={set('roleOther')} />}
        </>
      )}

      {step === 3 && (
        <>
          <Text style={T.callout}>All optional. Tap Finish anytime.</Text>
          <Label text="Pick an avatar" />
          <View style={styles.emojiGrid}>
            {EMOJIS.map((e) => {
              const on = draft.avatarEmoji === e;
              return (
                <PressScale key={e} accessibilityLabel={`Avatar ${e}`} accessibilityState={{ selected: on }} onPress={() => set('avatarEmoji')(on ? '' : e)} style={[styles.emoji, on && styles.chipOn]}>
                  <Text style={styles.emojiText}>{e}</Text>
                </PressScale>
              );
            })}
          </View>
          <Label text="Favorite specialty" />
          <Chips options={SPECIALTIES} value={draft.favoriteSpecialty} onChange={set('favoriteSpecialty')} toggle />
          <Label text="Years in the OR" />
          <Chips
            options={[...YEARS]}
            labels={YEARS_LABEL}
            value={draft.yearsInOr}
            onChange={set('yearsInOr')}
            toggle
          />
          <Field
            label="OR walk-up song"
            hint="What's playing in your room when you open?"
            value={draft.walkupSong}
            onChange={set('walkupSong')}
          />
        </>
      )}

      {problem !== '' && <Banner text={problem} tone="danger" icon="alert-circle" />}

      <View style={styles.nav}>
        {step > 0 && <Button kind="secondary" label="Back" icon="chevron-left" onPress={back} disabled={saving} style={{ flex: 1 }} />}
        <Button
          label={last ? (preview ? 'Finish preview' : 'Finish') : 'Next'}
          icon={last ? 'check' : undefined}
          onPress={next}
          busy={saving}
          style={{ flex: step > 0 ? 1.4 : 1 }}
        />
      </View>

      {preview && <Button kind="ghost" label="Close preview" onPress={onClose} />}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={[T.callout, { color: C.text, fontWeight: '600' }]}>{text}</Text>;
}

function Chips(props: {
  options: string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
  /** Tapping the chosen chip again clears it (for optional questions). */
  toggle?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {props.options.map((o) => {
        const on = props.value === o;
        return (
          <PressScale key={o} accessibilityState={{ selected: on }} onPress={() => props.onChange(on && props.toggle ? '' : o)} style={[styles.chip, on && styles.chipOn]}>
            {on && <Icon name="check" size={18} />}
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{props.labels?.[o] ?? o}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.lg },
  dots: { flexDirection: 'row', gap: S.sm },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.line },
  dotOn: { backgroundColor: C.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: {
    minHeight: 48,
    paddingHorizontal: S.lg,
    borderRadius: R.control,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chipText: { fontFamily: F, color: C.text, fontSize: 17, fontWeight: '600' },
  chipTextOn: { color: C.accent },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  emoji: {
    width: 56,
    height: 56,
    borderRadius: R.control,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 28 },
  nav: { flexDirection: 'row', gap: S.md, marginTop: S.xs },
});
