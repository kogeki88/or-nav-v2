// The Me tab for nurses: profile details, updates, sign out. Search and cards live in the Library tab.
import { View } from 'react-native';

import { signOut } from '../auth/supabase';
import ProfileCard from '../profile/ProfileCard';
import type { ProfileRow } from '../profile/profile';
import { S } from '../theme';
import { Button, DetailRow, Group, SectionLabel } from '../ui/kit';
import { installedVersion } from '../updater';
import UpdatePanel, { UpdateState } from './UpdatePanel';

export default function RegularView({ update, profile }: { update: UpdateState; profile: ProfileRow | null }) {
  return (
    <View>
      {profile && <ProfileCard profile={profile} />}

      <SectionLabel text="App" />
      <Group style={{ paddingHorizontal: S.lg }}>
        <DetailRow first icon="phone-portrait-outline" label="Version" value={installedVersion()} />
      </Group>
      <View style={{ gap: S.md, marginTop: S.md }}>
        <UpdatePanel update={update} primary={false} />
        <Button kind="ghost" tone="danger" icon="log-out-outline" label="Sign out" onPress={signOut} />
      </View>
    </View>
  );
}
