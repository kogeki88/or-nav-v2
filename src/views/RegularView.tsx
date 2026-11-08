// What nurses see. Brick 3 search and Brick 4 preference cards will live here.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut } from '../auth/supabase';
import ProfileCard from '../profile/ProfileCard';
import type { ProfileRow } from '../profile/profile';
import { C, ui } from '../theme';
import UpdatePanel, { UpdateState } from './UpdatePanel';

export default function RegularView({ update, profile }: { update: UpdateState; profile: ProfileRow | null }) {
  return (
    <View style={styles.wrap}>
      {profile && <ProfileCard profile={profile} />}

      <View style={[ui.card, styles.placeholder]}>
        <Text style={styles.placeholderText}>Instrument search is coming in a later update.</Text>
      </View>

      <UpdatePanel update={update} primary />

      <Pressable accessibilityRole="button" onPress={signOut} style={ui.secondary}>
        <Text style={ui.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  placeholder: { paddingVertical: 20 },
  placeholderText: { color: C.muted, fontSize: 17, textAlign: 'center' },
});
