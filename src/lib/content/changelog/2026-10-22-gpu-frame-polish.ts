import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Smoother editing inside frames',
  items: [
    'Rotated elements show a rotated selection box and resize along their own sides.',
    'After a union, the selection covers the whole merged shape.',
    '⌘-click or double-click reaches elements inside a group; Esc goes back to the group.',
    'SVG, text and images pasted over a frame land inside it, without flicker.',
    'Pasted text reads on dark frames and stays on one line.'
  ]
} satisfies ChangelogEntry;
