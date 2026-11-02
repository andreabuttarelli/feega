import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Strokes, shadows and styles',
  items: [
    'New strokes are 1 px, and the stroke popover has its width with labelled dash length and gap.',
    'Pen paths land with a 1 px stroke and no fill.',
    'Drop shadows start at X 0, Y 4, blur 4 and are edited as X, Y, blur, spread and colour; Show behind is a toggle.',
    'A fill added to a stack starts white.',
    'Saving a style is one Create style menu.'
  ]
} satisfies ChangelogEntry;
