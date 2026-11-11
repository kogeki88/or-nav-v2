// Icon for an item, by its category, so lists are easy to scan. Unknown categories get a box.
import type { IconName } from '../../ui/kit';

const BY_CATEGORY: [RegExp, IconName][] = [
  [/instrument|clamp|forceps|retractor|scissor/i, 'scissors'],
  [/suture|stitch|thread/i, 'paperclip'],
  [/implant|device|graft|valve|mesh/i, 'cpu'],
  [/drug|med|fluid|solution/i, 'droplet'],
  [/drape|gown|glove|linen/i, 'layers'],
];

export function itemIcon(category: string | null | undefined): IconName {
  if (!category) return 'box';
  return BY_CATEGORY.find(([re]) => re.test(category))?.[1] ?? 'box';
}
