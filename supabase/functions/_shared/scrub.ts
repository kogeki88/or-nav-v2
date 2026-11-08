// Patient-information scrubber for the omnibar. Pure TypeScript: the app runs it before anything is sent,
// and the server (supabase/functions/omnibar) runs the same file again.
//
// Based on the HIPAA Safe Harbor identifiers that can appear in typed text. It replaces identifiers
// (dates, numbers, contacts, addresses) and BLOCKS the message when it sees a likely patient name or a
// date of birth, because names cannot be removed reliably. It is a backstop, not a guarantee:
// staff must still not type patient information.

export type ScrubResult =
  | { ok: true; text: string; removed: string[] }
  | { ok: false; reason: string };

type Rule = { label: string; tag: string; re: RegExp };

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const UNITS = 'mm|cm|ml|mL|cc|mg|mcg|g|kg|l|in|fr|french|gauge|ga|units?|u';

// Order matters: specific patterns first, so a phone number is not eaten by the long-number rule.
const RULES: Rule[] = [
  { label: 'an email address', tag: '[EMAIL]', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/gi },
  { label: 'a web address', tag: '[URL]', re: /\b(?:https?:\/\/|www\.)\S+/gi },
  { label: 'an IP address', tag: '[IP]', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { label: 'a Social Security number', tag: '[SSN]', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: 'a phone number', tag: '[PHONE]', re: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  { label: 'a date', tag: '[DATE]', re: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g },
  { label: 'a date', tag: '[DATE]', re: /\b\d{4}-\d{1,2}-\d{1,2}\b/g },
  { label: 'a date', tag: '[DATE]', re: new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, 'gi') },
  { label: 'a date', tag: '[DATE]', re: new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b\\.?(?:,?\\s+\\d{4})?`, 'gi') },
  { label: 'an age over 89', tag: '[AGE]', re: /\b(?:9\d|1\d\d)\s*(?:-?\s*(?:y\/?o|yo|yrs?|years?)(?:\s*old)?)\b/gi },
  {
    label: 'a street address',
    tag: '[ADDRESS]',
    re: /\b\d{1,6}\s+(?:[A-Za-z]+\s+){1,3}(?:st|street|ave|avenue|rd|road|blvd|boulevard|drive|ln|lane|ct|court|way|pl|place|hwy|highway)\b\.?/gi,
  },
  {
    label: 'a record or account number',
    tag: '[ID]',
    re: /\b(?:mrn|med(?:ical)?\s*rec(?:ord)?s?|acct|account|fin|csn|encounter|visit|chart|case|serial|s\/n|insurance|policy|member|license|plate)\s*(?:no\.?|number|num|#)?\s*[:#]?\s*[a-z]*\d[\w-]{2,}/gi,
  },
  { label: 'a long number', tag: '[ID]', re: new RegExp(`\\b\\d{5,}\\b(?!\\s*(?:${UNITS})\\b)`, 'g') },
];

// A date of birth almost always comes with a name, so it blocks the whole message.
const DOB = /\b(?:dob|d\.o\.b\.?|date\s+of\s+birth|birth\s*date|birthday|born\s+(?:on|in))\b/i;

// Words that often follow "patient" or "room 4" and are not names.
const NOT_NAMES = new Set(
  (
    'a an the is was has had in on at for to of and or with without who that this needs need ready arrived arriving ' +
    'positioning position positioned prep prepped care safety room bed side weight height allergy allergies allergic ' +
    'supine prone lateral lithotomy sitting beach chair trendelenburg reverse transfer transport consent family ' +
    'count counts warming warmer pad roll rolls draped drape will can should may if when after before ' +
    'pre post op preop postop intra or pacu holding asleep awake intubated extubated stable unstable ' +
    'education teaching identifiers identification name names id band'
  ).split(' '),
);

// Common US first names and surnames. Checked ONLY right after a patient cue ("pt maria", "patient lopez"),
// because many are also instrument names (Kelly, Mayo, Allis) that are fine elsewhere.
const COMMON_NAMES = new Set(
  (
    'james mary robert patricia john jennifer michael linda david elizabeth william barbara richard susan joseph ' +
    'jessica thomas sarah charles karen christopher lisa daniel nancy matthew betty anthony margaret mark sandra ' +
    'donald ashley steven kimberly paul emily andrew donna joshua michelle kenneth carol kevin amanda brian dorothy ' +
    'george melissa timothy deborah ronald stephanie edward rebecca jason sharon jeffrey laura ryan cynthia jacob ' +
    'kathleen gary amy nicholas angela eric shirley jonathan anna stephen brenda larry pamela justin emma scott ' +
    'nicole brandon helen benjamin samantha samuel katherine gregory christine alexander debra frank rachel patrick ' +
    'carolyn raymond janet jack catherine dennis maria jerry heather tyler diane aaron ruth jose julie adam olivia ' +
    'henry joyce nathan virginia douglas victoria zachary kelly peter lauren kyle christina juan joan carlos luis ' +
    'jorge miguel ana rosa carmen sofia lucia mohammed ahmed wei li mei hiroshi yuki priya raj ' +
    'smith johnson williams brown jones garcia miller davis rodriguez martinez hernandez lopez gonzalez wilson ' +
    'anderson thomas taylor moore jackson martin lee perez thompson white harris sanchez clark ramirez lewis ' +
    'robinson walker young allen king wright scott torres nguyen hill flores green adams nelson baker hall rivera ' +
    'campbell mitchell carter roberts gomez phillips evans turner diaz parker cruz edwards collins reyes stewart ' +
    'morris morales murphy cook rogers gutierrez ortiz morgan cooper peterson bailey reed kelly howard ramos kim ' +
    'cox ward richardson watson brooks chavez wood james bennett gray mendoza ruiz hughes price alvarez castillo ' +
    'sanders patel myers long ross foster jimenez chen wang zhang liu singh kumar shah khan'
  ).split(' '),
);

const CUE =/\b(?:pt|pts|patient|patients|mr|mrs|ms|miss|mx)\b\.?\s*(?:'s\s+)?(?:name\s*(?:is|:)?\s*)?([A-Za-z][A-Za-z'’-]+)/gi;
const NAME_LABEL = /\b(?:pt|patient)?\s*name\s*(?:is|:)\s*[A-Za-z]/i;
const ROOM = /\b(?:room|rm|bed|bay)\s*#?\s*\d+[a-z]?\s*[-:,]?\s*([A-Z][a-z'’-]+)/g;
const TITLE = /\b(?:mr|mrs|ms|miss|mx)\b\.?\s+([A-Za-z][A-Za-z'’-]+)/gi;

function allowedName(word: string, allow: Set<string>): boolean {
  const w = word.toLowerCase();
  return NOT_NAMES.has(w) || allow.has(w);
}

/**
 * Cleans one message. `allowNames` are staff names that may appear (surgeons in the library).
 * Returns the cleaned text, or ok: false with a plain-language reason to show the nurse.
 */
export function scrub(input: string, allowNames: string[] = []): ScrubResult {
  const allow = new Set(allowNames.flatMap((n) => n.toLowerCase().split(/[^a-z'’-]+/)).filter((w) => w.length > 1));
  const text = input.normalize('NFKC');

  if (DOB.test(text)) return { ok: false, reason: 'Remove the date of birth. Do not type patient information here.' };
  if (NAME_LABEL.test(text)) return { ok: false, reason: "Remove the patient's name. Do not type patient information here." };

  for (const m of text.matchAll(TITLE)) {
    // "Mrs. Garcia", "mr jones"; not "has ms for years".
    if (!allowedName(m[1], allow)) return { ok: false, reason: "Remove the patient's name. Do not type patient information here." };
  }
  for (const m of text.matchAll(CUE)) {
    const word = m[1];
    // "patient Smith", "pt Jones": a capitalized word that is not an ordinary word, or a common name in any case.
    const looksLikeName = (/^[A-Z]/.test(word) && !allowedName(word, allow)) || (COMMON_NAMES.has(word.toLowerCase()) && !allow.has(word.toLowerCase()));
    if (looksLikeName) {
      return { ok: false, reason: "Remove the patient's name. Do not type patient information here." };
    }
  }
  for (const m of text.matchAll(ROOM)) {
    if (!allowedName(m[1], allow)) return { ok: false, reason: "Remove the patient's name. Do not type patient information here." };
  }

  let out = text;
  const removed: string[] = [];
  for (const rule of RULES) {
    out = out.replace(rule.re, () => {
      if (!removed.includes(rule.label)) removed.push(rule.label);
      return rule.tag;
    });
  }
  return { ok: true, text: out, removed };
}

/** "a date and a phone number" — for the note under a sent message. */
export function describeRemoved(removed: string[]): string {
  if (removed.length === 0) return '';
  if (removed.length === 1) return removed[0];
  return `${removed.slice(0, -1).join(', ')} and ${removed[removed.length - 1]}`;
}
