// First sign-in questionnaire: questions, choices and checks. Pure TypeScript so Node can test it.
// Matches the Supabase table in supabase/migrations/0001_profiles.sql.

export const DEPARTMENTS = ['Main OR', 'CVOR / Cardiac OR', 'Ambulatory / Outpatient', 'L&D OR', 'Pediatric OR', 'Other'];
export const ROLES = ['Scrub nurse', 'Circulating nurse', 'Surgical tech', 'Charge nurse', 'Educator', 'Other'];
export const EMOJIS = ['🩺', '🫀', '🧠', '🦴', '💉', '🧤', '😷', '⚡', '🌟', '🦸', '🐢', '🎧'];
export const SPECIALTIES = ['Cardiac', 'Ortho', 'Neuro', 'General', 'Robotics', 'Peds', 'Trauma', 'Other'];
export const YEARS = ['<1', '1-3', '3-10', '10+'] as const;
export const YEARS_LABEL: Record<(typeof YEARS)[number], string> = {
  '<1': 'Under 1 year',
  '1-3': '1–3 years',
  '3-10': '3–10 years',
  '10+': '10+ years',
};

export const STEP_TITLES = ['About you', 'Where you work', 'Your role', 'Just for fun'];
export const STEP_COUNT = STEP_TITLES.length;

/** What the user is typing; every field is a string while editing. */
export type Draft = {
  fullName: string;
  nickname: string;
  facility: string;
  department: string;
  departmentOther: string;
  role: string;
  roleOther: string;
  avatarEmoji: string;
  favoriteSpecialty: string;
  yearsInOr: string;
  walkupSong: string;
};

export const EMPTY_DRAFT: Draft = {
  fullName: '',
  nickname: '',
  facility: '',
  department: '',
  departmentOther: '',
  role: '',
  roleOther: '',
  avatarEmoji: '',
  favoriteSpecialty: '',
  yearsInOr: '',
  walkupSong: '',
};

/** One row of public.profiles (without id and timestamps). */
export type ProfileRow = {
  full_name: string;
  nickname: string | null;
  facility: string;
  department: string;
  role: string;
  avatar_emoji: string | null;
  favorite_specialty: string | null;
  years_in_or: string | null;
  walkup_song: string | null;
};

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
const optional = (s: string) => (clean(s) === '' ? null : clean(s));
const pickOrOther = (pick: string, other: string) => (pick === 'Other' ? clean(other) : pick);

/** Returns a plain-language problem with this step, or null if the user may go on. */
export function validateStep(step: number, d: Draft): string | null {
  if (step === 0) {
    if (clean(d.fullName) === '') return 'Please type your name.';
    if (clean(d.fullName).length > 100) return 'Name is too long (100 characters max).';
    if (clean(d.nickname).length > 40) return 'Nickname is too long (40 characters max).';
  }
  if (step === 1) {
    if (clean(d.facility) === '') return 'Please type your facility.';
    if (clean(d.facility).length > 120) return 'Facility name is too long (120 characters max).';
    if (d.department === '') return 'Please pick your department.';
    if (d.department === 'Other' && clean(d.departmentOther) === '') return 'Please type your department.';
    if (pickOrOther(d.department, d.departmentOther).length > 60) return 'Department is too long (60 characters max).';
  }
  if (step === 2) {
    if (d.role === '') return 'Please pick your role.';
    if (d.role === 'Other' && clean(d.roleOther) === '') return 'Please type your role.';
    if (pickOrOther(d.role, d.roleOther).length > 60) return 'Role is too long (60 characters max).';
  }
  if (step === 3) {
    if (clean(d.walkupSong).length > 120) return 'Song is too long (120 characters max).';
  }
  return null;
}

/** First problem in any step, or null when the whole questionnaire is valid. */
export function validateAll(d: Draft): string | null {
  for (let s = 0; s < STEP_COUNT; s++) {
    const problem = validateStep(s, d);
    if (problem) return problem;
  }
  return null;
}

/** Turns the draft into a table row. Nickname defaults to the first name. */
export function toRow(d: Draft): ProfileRow {
  const fullName = clean(d.fullName);
  return {
    full_name: fullName,
    nickname: optional(d.nickname) ?? fullName.split(' ')[0],
    facility: clean(d.facility),
    department: pickOrOther(d.department, d.departmentOther),
    role: pickOrOther(d.role, d.roleOther),
    avatar_emoji: d.avatarEmoji || null,
    favorite_specialty: d.favoriteSpecialty || null,
    years_in_or: (YEARS as readonly string[]).includes(d.yearsInOr) ? d.yearsInOr : null,
    walkup_song: optional(d.walkupSong),
  };
}
