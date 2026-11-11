// Shared building blocks from design/DESIGN.md. Screens compose these; they never restyle them.
import Feather from '@expo/vector-icons/Feather';
import { ComponentProps, ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { C, F, R, S, T, ui } from '../theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 22, color = C.accent }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function IconTile({ name, color = C.accent, bg = 'transparent', size = 40 }: { name: IconName; color?: string; bg?: string; size?: number }) {
  return (
    <View style={[ui.iconTile, { backgroundColor: bg, width: size, height: size }]}>
      <Icon name={name} color={color} size={Math.round(size * 0.55)} />
    </View>
  );
}

type Tone = 'warn' | 'ok' | 'danger' | 'accent' | 'neutral';
const TONE: Record<Tone, { fg: string; bg: string }> = {
  warn: { fg: C.warn, bg: C.warnSoft },
  ok: { fg: C.ok, bg: C.okSoft },
  danger: { fg: C.danger, bg: C.dangerSoft },
  accent: { fg: C.accent, bg: C.accentSoft },
  neutral: { fg: C.text2, bg: C.line },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Pressable that gently shrinks while held (touch feedback). Reduce motion: no shrink.
 * Use it for anything that acts like a button; rows use a background tint instead.
 */
export function PressScale({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  accessibilityState,
  accessibilityRole = 'button',
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityState?: { busy?: boolean; disabled?: boolean; selected?: boolean };
  accessibilityRole?: 'button' | 'tab';
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduce = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => (reduce.current = r));
  }, []);
  const to = (v: number) => {
    if (reduce.current) return;
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: v === 1 ? 6 : 0, useNativeDriver: true }).start();
  };
  // The style (including flex) goes on the pressable itself, so it lays out like a plain View.
  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      onPress={disabled ? undefined : onPress}
      onPressIn={() => !disabled && to(0.97)}
      onPressOut={() => to(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  icon,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
  tone,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
  tone?: 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const color = kind === 'primary' ? C.onAccent : tone === 'danger' ? C.danger : C.accent;
  const base = kind === 'primary' ? ui.primary : kind === 'secondary' ? ui.secondary : styles.ghost;
  return (
    <PressScale
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityState={{ busy }}
      style={[base, tone === 'danger' && kind === 'secondary' && { borderColor: C.danger }, (busy || disabled) && ui.dim, style]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon && <Icon name={icon} color={color} size={20} />}
          <Text style={[kind === 'primary' ? ui.primaryText : ui.secondaryText, { color }]}>{label}</Text>
        </>
      )}
    </PressScale>
  );
}

/** Profile picture: the chosen emoji, or initials, in a soft accent circle. */
export function Avatar({ emoji, name, size = 64 }: { emoji?: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontFamily: F, fontSize: emoji ? size * 0.5 : size * 0.36, color: C.accent, fontWeight: '700' }}>{emoji || initials}</Text>
    </View>
  );
}

/** One label + value line inside a Group. Value can wrap; long ids can truncate in the middle. */
export function DetailRow({ label, value, first, color, icon, middle }: { label: string; value: string; first?: boolean; color?: string; icon?: IconName; middle?: boolean }) {
  return (
    <View style={[styles.detail, !first && styles.detailLine]} accessible accessibilityLabel={`${label}: ${value}`}>
      {icon && <Icon name={icon} size={18} color={C.text3} />}
      <Text style={[T.callout, { flexShrink: 0 }]}>{label}</Text>
      <Text
        style={[T.body, styles.detailValue, color ? { color, fontWeight: '600' } : null]}
        numberOfLines={middle ? 1 : undefined}
        ellipsizeMode={middle ? 'middle' : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

/** Two or three side-by-side choices (for example Regular view | Admin view). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segTrack} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <PressScale key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={[styles.seg, on && styles.segOn]}>
            {o.icon && <Icon name={o.icon} size={18} color={on ? C.onAccent : C.text2} />}
            <Text style={[styles.segText, on && { color: C.onAccent }]}>{o.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={[T.callout, { color: C.text, width: 48, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{pct}%</Text>
    </View>
  );
}

export function IconButton({ name, label, onPress, color = C.text2, bg = C.line, size = 36 }: { name: IconName; label: string; onPress: () => void; color?: string; bg?: string; size?: number }) {
  return (
    <PressScale accessibilityLabel={label} onPress={onPress} style={styles.iconBtn}>
      <View style={[styles.iconBtnInner, { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name={name} color={color} size={Math.round(size * 0.56)} />
      </View>
    </PressScale>
  );
}

export function SectionLabel({ text, right }: { text: string; right?: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={T.caption} accessibilityRole="header">
        {text}
      </Text>
      {right ? <Text style={[T.caption, { color: C.text3 }]}>{right}</Text> : null}
    </View>
  );
}

export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[ui.group, style]}>{children}</View>;
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  first,
  label,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label ?? [title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: C.fill }]}
    >
      {!first && <View style={styles.divider} />}
      {icon && <IconTile name={icon} />}
      <View style={styles.rowText}>
        <Text style={T.bodyStrong} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={T.callout} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && !right && <Icon name="chevron-right" color={C.text3} size={20} />}
    </Pressable>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.search}>
      <Icon name="search" color={C.text3} size={20} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.text3}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search"
      />
      {value !== '' && <IconButton name="x" label="Clear search" onPress={() => onChange('')} bg="transparent" color={C.text3} />}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.chips} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>
              {o.label}
              {o.count !== undefined ? <Text style={{ color: on ? C.accent : C.text3 }}>{`  ${o.count}`}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Loading placeholder: grey rows that gently pulse (still when reduce motion is on). */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [pulse]);
  return (
    <Group>
      {Array.from({ length: count }, (_, i) => (
        <Animated.View key={i} style={[styles.row, { opacity: pulse }]} accessibilityLabel={i === 0 ? 'Loading' : undefined}>
          {i > 0 && <View style={styles.divider} />}
          <View style={[ui.iconTile, { backgroundColor: C.fill, borderRadius: R.control }]} />
          <View style={styles.rowText}>
            <View style={[styles.bar, { width: '62%' }]} />
            <View style={[styles.bar, { width: '38%', height: 12 }]} />
          </View>
        </Animated.View>
      ))}
    </Group>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <IconTile name={icon} size={56} />
      {/* alignSelf stretch: on Samsung phones a centered bold line was measured too narrow and its last word was cut off. */}
      <Text style={[T.headline, { textAlign: 'center', alignSelf: 'stretch' }]}>{title}</Text>
      <Text style={[T.callout, { textAlign: 'center', alignSelf: 'stretch' }]}>{body}</Text>
      {action}
    </View>
  );
}

export function Banner({ text, tone = 'warn', icon = 'cloud-off' }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = TONE[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Icon name={icon} color={t.fg} size={18} />
      <Text style={[T.callout, { color: t.fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  hint,
  multiline,
  changed,
  secret,
  placeholder,
  keyboardType,
  autoComplete,
  editable = true,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  multiline?: boolean;
  changed?: boolean;
  /** Password field: hidden, with a show / hide button. */
  secret?: boolean;
  placeholder?: string;
  keyboardType?: 'email-address' | 'default';
  autoComplete?: 'email' | 'name' | 'current-password' | 'new-password';
  editable?: boolean;
  onSubmit?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <Text style={[T.callout, { color: C.text, fontWeight: '600' }]}>{label}</Text>
        {changed && <Badge label="Changed" tone="accent" />}
      </View>
      {hint ? <Text style={[T.callout, { color: C.text3, fontSize: 14 }]}>{hint}</Text> : null}
      <View style={[styles.inputWrap, (focused || changed) && { borderColor: C.accent }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMulti]}
          placeholder={placeholder}
          placeholderTextColor={C.text3}
          accessibilityLabel={label}
          secureTextEntry={secret && !shown}
          autoCapitalize={secret || keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={!secret && keyboardType !== 'email-address'}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          returnKeyType={onSubmit ? 'go' : undefined}
        />
        {secret && (
          <IconButton name={shown ? 'eye-off' : 'eye'} label={shown ? 'Hide password' : 'Show password'} onPress={() => setShown((s) => !s)} bg="transparent" color={C.text2} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minHeight: 24, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center', alignSelf: 'center' },
  badgeText: { fontFamily: F, fontSize: 13, fontWeight: '700' },
  ghost: { minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: S.sm, paddingHorizontal: S.md },
  iconBtn: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  avatar: { backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  detail: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 52, paddingVertical: S.md },
  detailLine: { borderTopWidth: 1, borderTopColor: C.line },
  detailValue: { flex: 1, textAlign: 'right' },
  segTrack: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.control + 2, padding: 4, gap: 4, borderWidth: 1, borderColor: C.line },
  seg: { flex: 1, minHeight: 48, borderRadius: R.control - 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: S.sm },
  segOn: { backgroundColor: C.accent },
  segText: { fontFamily: F, color: C.text2, fontSize: 16, fontWeight: '700' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: C.accent },
  iconBtnInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: S.xs, marginTop: S.xl, marginBottom: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 64, paddingHorizontal: S.lg, paddingVertical: S.sm },
  divider: { position: 'absolute', top: 0, left: 68, right: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: C.line },
  rowText: { flex: 1, gap: 2 },
  search: { flexDirection: 'row', alignItems: 'center', minHeight: 52, backgroundColor: C.surface, borderRadius: R.control, paddingLeft: S.md, borderWidth: 1, borderColor: C.line },
  searchInput: { flex: 1, fontFamily: F, color: C.text, fontSize: 17, paddingHorizontal: S.sm, minHeight: 52 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { minHeight: 44, paddingHorizontal: S.lg, borderRadius: R.control, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, justifyContent: 'center' },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipText: { fontFamily: F, color: C.text, fontSize: 16, fontWeight: '600' },
  chipTextOn: { color: C.accent },
  bar: { height: 14, borderRadius: 7, backgroundColor: C.line },
  empty: { alignItems: 'center', gap: S.md, paddingVertical: S.xxl, paddingHorizontal: S.xl },
  banner: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.control },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: R.control, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  input: { flex: 1, minHeight: 52, fontFamily: F, color: C.text, fontSize: 17, paddingHorizontal: S.lg },
  inputMulti: { minHeight: 96, paddingTop: S.md, textAlignVertical: 'top' },
});
