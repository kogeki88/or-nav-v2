// First sign-in questionnaire: 4 short steps. In preview mode (admin) nothing is saved.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { C, ui } from '../theme';
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

  const last = step === STEP_COUNT - 1;

  return (
    <View style={styles.wrap}>
      {preview && (
        <View style={styles.previewBanner}>
          <Text style={styles.previewText}>Preview — answers are not saved</Text>
        </View>
      )}

      <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}>
        {STEP_TITLES.map((t, i) => (
          <View key={t} style={[styles.dot, i <= step && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.stepCount}>
        Step {step + 1} of {STEP_COUNT}
      </Text>
      <Text style={styles.heading}>{STEP_TITLES[step]}</Text>

      {step === 0 && (
        <>
          <Field label="Your name" value={draft.fullName} onChange={set('fullName')} autoComplete="name" />
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
          <Text style={styles.hint}>All optional. Tap Finish anytime.</Text>
          <Label text="Pick an avatar" />
          <View style={styles.emojiGrid}>
            {EMOJIS.map((e) => {
              const on = draft.avatarEmoji === e;
              return (
                <Pressable
                  key={e}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => set('avatarEmoji')(on ? '' : e)}
                  style={[styles.emoji, on && styles.chipOn]}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
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

      {problem !== '' && <Text style={styles.problem}>{problem}</Text>}

      <View style={styles.nav}>
        {step > 0 && (
          <Pressable accessibilityRole="button" onPress={back} disabled={saving} style={[ui.secondary, styles.navBtn]}>
            <Text style={ui.secondaryText}>Back</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={next}
          disabled={saving}
          style={({ pressed }) => [ui.primary, styles.navBtn, (pressed || saving) && ui.dim]}
        >
          {saving ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={ui.primaryText}>{last ? (preview ? 'Finish preview' : 'Finish') : 'Next'}</Text>
          )}
        </Pressable>
      </View>

      {preview && (
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.link}>
          <Text style={styles.linkText}>Close preview</Text>
        </Pressable>
      )}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Field(props: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: 'name';
}) {
  return (
    <View style={styles.field}>
      <Label text={props.label} />
      {props.hint && <Text style={styles.hint}>{props.hint}</Text>}
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChange}
        autoComplete={props.autoComplete}
        placeholderTextColor={C.muted}
      />
    </View>
  );
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
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => props.onChange(on && props.toggle ? '' : o)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{props.labels?.[o] ?? o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  previewBanner: { backgroundColor: C.card, borderColor: C.accent, borderWidth: 1, borderRadius: 12, padding: 12 },
  previewText: { color: C.accent, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.card },
  dotOn: { backgroundColor: C.accent },
  stepCount: { color: C.muted, fontSize: 15 },
  heading: { color: C.text, fontSize: 26, fontWeight: '700' },
  field: { gap: 6 },
  label: { color: C.text, fontSize: 17, fontWeight: '600' },
  hint: { color: C.muted, fontSize: 15 },
  input: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: C.card,
    color: C.text,
    fontSize: 18,
    paddingHorizontal: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.card,
    justifyContent: 'center',
  },
  chipOn: { borderColor: C.accent, backgroundColor: '#0C2A3A' },
  chipText: { color: C.text, fontSize: 17 },
  chipTextOn: { color: C.accent, fontWeight: '700' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emoji: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 28 },
  problem: { color: C.danger, fontSize: 16 },
  nav: { flexDirection: 'row', gap: 12, marginTop: 4 },
  navBtn: { flex: 1 },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: C.accent, fontSize: 17, fontWeight: '600' },
});
