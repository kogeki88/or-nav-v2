// The Me tab for nurses: profile, updates, sign out. Search and cards live in the Library tab.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut } from '../auth/supabase';
import ProfileCard from '../profile/ProfileCard';
import type { ProfileRow } from '../profile/profile';
import { ui } from '../theme';
import UpdatePanel, { UpdateState } from './UpdatePanel';

export default function RegularView({ update, profile }: { update: UpdateState; profile: ProfileRow | null }) {
  return (
    <View style={styles.wrap}>
      {profile && <ProfileCard profile={profile} />}

      <UpdatePanel update={update} primary />

      <Pressable accessibilityRole="button" onPress={signOut} style={ui.secondary}>
        <Text style={ui.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
});
