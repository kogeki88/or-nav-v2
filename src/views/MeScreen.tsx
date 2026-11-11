// Me tab: who you are, the Regular | Admin switch (admins only), and app settings.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SignedInUser } from '../auth/supabase';
import type { ProfileRow } from '../profile/profile';
import { C, R, S, T } from '../theme';
import { Avatar, Segmented } from '../ui/kit';
import AdminView from './AdminView';
import RegularView from './RegularView';
import type { UpdateState } from './UpdatePanel';
import { ViewName, readSavedView, saveView } from './ViewToggle';

type Props = {
  user: SignedInUser;
  profile: ProfileRow;
  update: UpdateState;
  welcome: string;
  topInset: number;
  bottomSpace: number;
  onPreviewQuestionnaire: () => void;
};

export default function MeScreen({ user, profile, update, welcome, topInset, bottomSpace, onPreviewQuestionnaire }: Props) {
  const [view, setView] = useState<ViewName>(readSavedView);
  const isAdmin = user.role === 'admin';
  const shown: ViewName = isAdmin ? view : 'regular';
  const name = profile.nickname || profile.full_name.split(' ')[0];

  return (
    <ScrollView style={{ flex: 1, marginBottom: bottomSpace }} contentContainerStyle={[styles.content, { paddingTop: topInset + S.lg }]}>
      <Text style={T.largeTitle} accessibilityRole="header">
        Me
      </Text>

      <View style={styles.hero} accessible accessibilityLabel={`${profile.full_name}, ${profile.role}, ${profile.department}, ${profile.facility}`}>
        <Avatar emoji={profile.avatar_emoji} name={profile.full_name} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={T.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[T.callout, { color: C.text }]} numberOfLines={1}>
            {profile.role}
          </Text>
          <Text style={T.callout} numberOfLines={2}>
            {profile.department} · {profile.facility}
          </Text>
        </View>
        {isAdmin && (
          <View style={styles.adminTag}>
            <Text style={styles.adminText}>Admin</Text>
          </View>
        )}
      </View>

      {welcome !== '' && <Text style={[T.callout, { color: C.ok }]}>{welcome}</Text>}

      {isAdmin && (
        <Segmented
          value={shown}
          onChange={(v) => {
            setView(v);
            saveView(v);
          }}
          options={[
            { key: 'regular', label: 'Regular view', icon: 'user' },
            { key: 'admin', label: 'Admin view', icon: 'tool' },
          ]}
        />
      )}

      {shown === 'regular' ? (
        <RegularView update={update} profile={profile} />
      ) : (
        <AdminView user={user} update={update} profile={profile} onPreviewQuestionnaire={onPreviewQuestionnaire} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: S.lg, paddingBottom: S.xxl, gap: S.lg },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.lg,
    padding: S.lg,
    borderRadius: R.card,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  adminTag: { alignSelf: 'flex-start', backgroundColor: C.accentSoft, borderRadius: 8, paddingHorizontal: 8, minHeight: 24, justifyContent: 'center' },
  adminText: { color: C.accent, fontSize: 13, fontWeight: '700' },
});
