// The fun answers from the setup questions. Name, role, department and facility are in the Me header.
// Empty optional answers are left out; if none are set, nothing shows.
import { View } from 'react-native';

import { S } from '../theme';
import { DetailRow, Group, SectionLabel } from '../ui/kit';
import { ProfileRow, YEARS, YEARS_LABEL } from './profile';

export default function ProfileCard({ profile }: { profile: ProfileRow }) {
  const years = (YEARS as readonly string[]).includes(profile.years_in_or ?? '')
    ? YEARS_LABEL[profile.years_in_or as (typeof YEARS)[number]]
    : null;
  const rows = (
    [
      ['heart-outline', 'Favorite specialty', profile.favorite_specialty],
      ['time-outline', 'Years in the OR', years],
      ['musical-notes-outline', 'Walk-up song', profile.walkup_song],
    ] as const
  ).filter(([, , v]) => v);
  if (rows.length === 0) return null;
  return (
    <View>
      <SectionLabel text="About you" />
      <Group style={{ paddingHorizontal: S.lg }}>
        {rows.map(([icon, label, value], i) => (
          <DetailRow key={label} first={i === 0} icon={icon} label={label} value={value as string} />
        ))}
      </Group>
    </View>
  );
}

/** "Hi, Sean 🩺" style greeting. */
export function greeting(profile: ProfileRow | null, fallbackEmail: string): string {
  if (!profile) return 'Signed in as ' + fallbackEmail;
  const name = profile.nickname || profile.full_name.split(' ')[0];
  return `Hi, ${name}${profile.avatar_emoji ? ' ' + profile.avatar_emoji : ''}`;
}
