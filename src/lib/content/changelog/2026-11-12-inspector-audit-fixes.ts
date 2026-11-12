import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Inspector by mouse and keyboard',
  items: [
    'Gradient stops move with the arrow keys, delete with Delete, and a + button adds one.',
    'Enter or Space on a fill swatch opens its editor once; Enter in a colour field keeps you in the field.',
    'Colour pickers and menus stay above the canvas toolbar and inside the window.',
    'Small inspector controls have larger click targets, and the text alignment buttons no longer overlap.',
    'A stack child set wider than its stack says it is capped.',
    'A toolbar menu closed with the mouse hands keys straight back to the canvas.'
  ]
} satisfies ChangelogEntry;
