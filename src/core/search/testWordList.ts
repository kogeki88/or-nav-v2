// TEST WORD LIST for search (used only by engine.test.ts, never by the app).
// Sean: to add a word, copy one row in WORD_LIST and change it.
//   typed: what the nurse types (spelled wrong is fine)
//   finds: the item name, or the card as "Surgeon / Procedure", that must come back
//   first: true when it must be the first result, not only somewhere in the list
import type { Card, Item } from '../../contracts/library';

function item(name: string, category: string, shelf: string, bin: string, synonyms: string[] = []): Item {
  return { id: name, department_id: 'd-main', name, category, shelf, sub_location: bin, synonyms, notes: null, photo_path: null, version: 1 };
}

function card(surgeon: string, procedure: string, specialty: string): Card {
  return { id: `${surgeon} / ${procedure}`, department_id: 'd-main', surgeon, procedure, specialty, notes: null, version: 1 };
}

/** The 16 sample Main OR items (supabase/seed/sample_main_or.sql) plus test-only OR items. */
export const TEST_ITEMS: Item[] = [
  item('Laparoscopic tower', 'Equipment', 'Bay 1', 'Left wall', ['lap tower', 'video tower']),
  item('Veress needle 120 mm', 'Disposable', 'A3', 'Bin 2', ['insufflation needle']),
  item('5 mm trocar', 'Disposable', 'A3', 'Bin 4', ['port', '5 port']),
  item('12 mm trocar', 'Disposable', 'A3', 'Bin 5', ['port', '12 port']),
  item('Maryland grasper', 'Instrument', 'B1', 'Lap tray', ['maryland dissector']),
  item('Clip applier 10 mm', 'Instrument', 'B1', 'Lap tray', ['clipper', 'ligaclip']),
  item('Specimen retrieval bag', 'Disposable', 'A4', 'Bin 1', ['endo bag', 'endocatch']),
  item('Mesh 15 x 15 cm', 'Implant', 'C2', 'Locked cabinet', ['hernia mesh']),
  item('Tacker 5 mm', 'Disposable', 'C2', 'Shelf 1', ['fixation device']),
  item('Bovie pencil', 'Disposable', 'A1', 'Bin 1', ['cautery', 'ESU pencil']),
  item('Tourniquet cuff 34 in', 'Equipment', 'D1', 'Hook 3', ['thigh cuff']),
  item('Saw blade sagittal', 'Disposable', 'D2', 'Bin 3', ['oscillating blade']),
  item('Pulse lavage', 'Disposable', 'D2', 'Bin 5', ['interpulse', 'irrigation gun']),
  item('Bone cement 40 g', 'Implant', 'D3', 'Locked cabinet', ['PMMA', 'cement']),
  item('0 Vicryl CT-1', 'Suture', 'S1', 'Drawer 2', ['vicryl zero']),
  item('4-0 Monocryl PS-2', 'Suture', 'S1', 'Drawer 4', ['monocryl']),
  // Test-only items (not in the sample library).
  item('Kocher clamp', 'Instrument', 'B2', 'Major tray'),
  item('Metzenbaum scissors', 'Instrument', 'B2', 'Major tray'),
  item('Yankauer suction', 'Disposable', 'A2', 'Bin 3', ['suction tip']),
  item('Debakey forceps', 'Instrument', 'B2', 'Major tray'),
  item('Richardson retractor', 'Instrument', 'B3', 'Retractor rack'),
];

/** The 3 sample Main OR cards. */
export const TEST_CARDS: Card[] = [
  card('Dr. Avery', 'Laparoscopic cholecystectomy', 'General'),
  card('Dr. Avery', 'Laparoscopic inguinal hernia repair', 'General'),
  card('Dr. Patel', 'Total knee arthroplasty', 'Orthopedics'),
];

export type WordRow = { typed: string; finds: string; first?: boolean };

export const WORD_LIST: WordRow[] = [
  { typed: 'bovee', finds: 'Bovie pencil', first: true },
  { typed: 'bovi', finds: 'Bovie pencil', first: true },
  { typed: 'kocker', finds: 'Kocher clamp', first: true },
  { typed: 'yankower', finds: 'Yankauer suction', first: true },
  { typed: 'metz', finds: 'Metzenbaum scissors', first: true },
  { typed: 'metzenbom', finds: 'Metzenbaum scissors', first: true },
  { typed: 'vikril', finds: '0 Vicryl CT-1', first: true },
  { typed: 'monokril', finds: '4-0 Monocryl PS-2', first: true },
  { typed: 'vic', finds: '0 Vicryl CT-1', first: true },
  { typed: 'veres', finds: 'Veress needle 120 mm', first: true },
  { typed: 'merriland', finds: 'Maryland grasper', first: true },
  { typed: 'turniket', finds: 'Tourniquet cuff 34 in', first: true },
  { typed: 'trokar', finds: '5 mm trocar' },
  { typed: 'cawtery', finds: 'Bovie pencil', first: true },
  { typed: 'grasper', finds: 'Maryland grasper', first: true },
  { typed: 'debakee', finds: 'Debakey forceps', first: true },
  { typed: 'richardsen', finds: 'Richardson retractor', first: true },
  { typed: 'colecystectomy', finds: 'Dr. Avery / Laparoscopic cholecystectomy', first: true },
  { typed: 'kolesistectomy', finds: 'Dr. Avery / Laparoscopic cholecystectomy', first: true },
  { typed: 'pattel', finds: 'Dr. Patel / Total knee arthroplasty', first: true },
  { typed: 'avery chole', finds: 'Dr. Avery / Laparoscopic cholecystectomy', first: true },
  { typed: 'artheroplasty', finds: 'Dr. Patel / Total knee arthroplasty', first: true },
];
