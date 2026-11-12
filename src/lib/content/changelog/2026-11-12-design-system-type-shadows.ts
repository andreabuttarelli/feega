import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Type scale and shadows from code',
  items: [
    'Importing from code turns your type scale and CSS typography rules into text styles, and your shadows into effect styles, applied to the layers that use them.',
    'Editing a text or effect style on the canvas writes the change back to the exact CSS declaration.',
    'Breakpoints and easings appear on the Design system board.'
  ]
} satisfies ChangelogEntry;
