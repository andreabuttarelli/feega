import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Finer controls in Properties',
  items: [
    'Colours can be edited as HEX, RGB or HSL, and picked from the screen where the browser allows.',
    'Drag a number itself to change it; click it to type.',
    'Keyframe markers are smaller and stay quiet until you hover or animate a value.',
    'A selected photo on a poster shows only its own settings.',
    'Effects are added with the + next to their title.'
  ]
} satisfies ChangelogEntry;
