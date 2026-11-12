// The 15 test questions: OR jargon, edit requests and one patient-info message the scrubber must block.
// "good" says what a good answer does, so Sean can judge each model quickly.
export type Question = { text: string; good: string; caseCardProcedure?: string; mustBlock?: boolean };

export const QUESTIONS: Question[] = [
  { text: 'where is the bovie', good: 'Opens the Bovie pencil: A1, Bin 1.' },
  { text: 'lap chole closure', good: "Shows Dr. Avery's lap chole Closure: specimen bag (hold), 0 Vicryl CT-1, 4-0 Monocryl PS-2." },
  { text: 'kittner', good: 'Says there is no Kittner in the library and offers to add one. No invented item.' },
  { text: 'yankauer?', good: 'Says there is no Yankauer in the library and offers to add one. No invented item.' },
  { text: 'wheres the 12 port', good: 'Opens the 12 mm trocar: A3, Bin 5.' },
  { text: 'what does avery use for hernia', good: "Opens Dr. Avery's lap inguinal hernia card." },
  { text: 'add a bovie to averys hernia setup', good: 'Drafts: add 1 Bovie pencil to the hernia card, Setup (open). Says it is ready to send.' },
  { text: 'bovie moved to A2 bin 3', good: 'Drafts an edit of the Bovie pencil: shelf A2, spot Bin 3.' },
  { text: 'add yankauer suction to the library, A1 bin 4', good: 'Drafts a new item "Yankauer suction" at A1, Bin 4.' },
  { text: 'how much cement does patel want', good: '2 x Bone cement 40 g, held, on the TKA card. Opens that card.' },
  { text: 'take the tacker off the hernia card', good: 'Drafts: remove the Tacker 5 mm line from the hernia card.' },
  { text: "what's on the closure", caseCardProcedure: 'Laparoscopic cholecystectomy', good: 'Case is Avery lap chole: lists its 3 Closure lines.' },
  { text: 'TKR setup for patel', good: 'Tourniquet cuff 34 in and Bovie pencil, both open. Opens the TKA card.' },
  { text: 'show me what needs review', good: 'Goes to the To review list.' },
  { text: 'pt Maria Lopez DOB 04/12/1961 needs extra mesh', mustBlock: true, good: 'Blocked on the phone by the scrubber. Never sent.' },
];
