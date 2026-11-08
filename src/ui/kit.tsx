// Shared building blocks from design/DESIGN.md. Screens compose these; they never restyle them.
import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode, useEffect, useRef } from 'react';
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

import { C, R, S, T, ui } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color = C.accent }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function IconTile({ name, color = C.accent, bg = C.accentSoft, size = 40 }: { name: IconName; color?: string; bg?: string; size?: number }) {
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

export function Button({
  label,
  icon,
  onPress,
  kind = 'primary',
  busy = false,
  tone,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  tone?: 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const color = kind === 'primary' ? C.bg : tone === 'danger' ? C.danger : C.accent;
  const base = kind === 'primary' ? ui.primary : kind === 'secondary' ? ui.secondary : styles.ghost;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => [
        base,
        tone === 'danger' && kind === 'secondary' && { borderColor: C.danger },
        (pressed || busy) && ui.dim,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon && <Icon name={icon} color={color} size={20} />}
          <Text style={[kind === 'primary' ? ui.primaryText : ui.secondaryText, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, label, onPress, color = C.text2, bg = C.line }: { name: IconName; label: string; onPress: () => void; color?: string; bg?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.iconBtn, pressed && ui.dim]}>
      <View style={[styles.iconBtnInner, { backgroundColor: bg }]}>
        <Icon name={name} color={color} size={20} />
      </View>
    </Pressable>
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
      style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: C.raised }]}
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
      {onPress && !right && <Icon name="chevron-forward" color={C.text3} size={20} />}
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
      {value !== '' && <IconButton name="close" label="Clear search" onPress={() => onChange('')} bg="transparent" color={C.text3} />}
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
          <View style={[ui.iconTile, { backgroundColor: C.line }]} />
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
      <Text style={[T.headline, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[T.callout, { textAlign: 'center' }]}>{body}</Text>
      {action}
    </View>
  );
}

export function Banner({ text, tone = 'warn', icon = 'cloud-offline-outline' }: { text: string; tone?: Tone; icon?: IconName }) {
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  multiline?: boolean;
  changed?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <Text style={[T.callout, { color: C.text, fontWeight: '600' }]}>{label}</Text>
        {changed && <Badge label="Changed" tone="accent" />}
      </View>
      {hint ? <Text style={[T.callout, { color: C.text3, fontSize: 14 }]}>{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti, changed && { borderColor: C.accent }]}
        placeholderTextColor={C.text3}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minHeight: 24, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center', alignSelf: 'center' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  ghost: { minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: S.sm, paddingHorizontal: S.md },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  iconBtnInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: S.xs, marginTop: S.xl, marginBottom: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 64, paddingHorizontal: S.lg, paddingVertical: S.sm },
  divider: { position: 'absolute', top: 0, left: 68, right: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: C.line },
  rowText: { flex: 1, gap: 2 },
  search: { flexDirection: 'row', alignItems: 'center', minHeight: 52, backgroundColor: C.surface, borderRadius: R.control, paddingLeft: S.md, borderWidth: 1, borderColor: C.line },
  searchInput: { flex: 1, color: C.text, fontSize: 17, paddingHorizontal: S.sm, minHeight: 52 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { minHeight: 44, paddingHorizontal: S.lg, borderRadius: R.control, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, justifyContent: 'center' },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 16, fontWeight: '600' },
  chipTextOn: { color: C.accent },
  bar: { height: 14, borderRadius: 7, backgroundColor: C.line },
  empty: { alignItems: 'center', gap: S.md, paddingVertical: S.xxl, paddingHorizontal: S.xl },
  banner: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.control },
  input: { minHeight: 52, borderRadius: R.control, backgroundColor: C.surface, color: C.text, fontSize: 17, paddingHorizontal: S.lg, borderWidth: 1, borderColor: C.line },
  inputMulti: { minHeight: 96, paddingTop: S.md, textAlignVertical: 'top' },
});
