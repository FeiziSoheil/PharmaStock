import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Custom typography roles (`text-body-sm`, `text-label-md`, …) must be registered as
 * font-size utilities. Otherwise tailwind-merge treats them like `text-*` colors and
 * drops `text-primary-foreground` / `text-secondary-foreground` on small buttons.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'headline-xl',
            'headline-lg',
            'headline-md',
            'headline-sm',
            'title-md',
            'title-sm',
            'body-lg',
            'body-md',
            'body-sm',
            'label-lg',
            'label-md',
            'label-sm',
            'kpi',
            'data-tabular',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
