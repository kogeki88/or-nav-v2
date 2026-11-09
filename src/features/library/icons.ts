// Icon for an item, by its category, so lists are easy to scan. Unknown categories get a box.
import type { IconName } from '../../ui/kit';

const BY_CATEGORY: [RegExp, IconName][] = [
  [/instrument|clamp|forceps|retractor|scissor/i, 'cut-outline'],
  [/suture|stitch|thread/i, 'bandage-outline'],
  [/implant|device|graft|valve|mesh/i, 'hardware-chip-outline'],
  [/drug|med|fluid|solution/i, 'flask-outline'],
  [/drape|gown|glove|linen/i, 'shirt-outline'],
];

export function itemIcon(category: string | null | undefined): IconName {
  if (!category) return 'cube-outline';
  return BY_CATEGORY.find(([re]) => re.test(category))?.[1] ?? 'cube-outline';
}
