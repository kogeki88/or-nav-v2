// Makes a version 4 UUID (random). Pure: the random source is passed in, so Node can test it.
// Pass Math.random by default; the adapter prefers crypto.randomUUID when the phone has it.
export function makeUuid(random: () => number = Math.random): string {
  const hex = Array.from({ length: 16 }, () => Math.floor(random() * 256));
  hex[6] = (hex[6] & 0x0f) | 0x40; // version 4
  hex[8] = (hex[8] & 0x3f) | 0x80; // variant 10xx
  const h = hex.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
