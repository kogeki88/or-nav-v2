// Kept for older callers; new screens use DetailRow from ../ui/kit directly.
import { DetailRow } from '../ui/kit';

export default function Row({ label, value, color, first }: { label: string; value: string; color?: string; first?: boolean }) {
  return <DetailRow label={label} value={value} color={color} first={first} middle />;
}
