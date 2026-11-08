// Shows the questionnaire answers. Empty optional answers are left out.
import { View } from 'react-native';

import { ui } from '../theme';
import Row from '../views/Row';
import { ProfileRow, YEARS, YEARS_LABEL } from './profile';

export default function ProfileCard({ profile }: { profile: ProfileRow }) {
  const years = (YEARS as readonly string[]).includes(profile.years_in_or ?? '')
    ? YEARS_LABEL[profile.years_in_or as (typeof YEARS)[number]]
    : null;
  const rows: [string, string | null][] = [
    ['Name', profile.full_name],
    ['Facility', profile.facility],
    ['Department', profile.department],
    ['Role', profile.role],
    ['Favorite specialty', profile.favorite_specialty],
    ['Years in the OR', years],
    ['Walk-up song', profile.walkup_song],
  ];
  return (
    <View style={ui.card}>
      {rows
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <Row key={label} label={label} value={value as string} />
        ))}
    </View>
  );
}

/** "Hi, Sean 🩺" style greeting. */
export function greeting(profile: ProfileRow | null, fallbackEmail: string): string {
  if (!profile) return 'Signed in as ' + fallbackEmail;
  const name = profile.nickname || profile.full_name.split(' ')[0];
  return `Hi, ${name}${profile.avatar_emoji ? ' ' + profile.avatar_emoji : ''}`;
}
