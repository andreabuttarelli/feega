import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Steadier stacks',
  items: [
    'Wrapping a stack in another stack keeps buttons and groups in one piece.',
    'Dragging a layer in the Layers panel reorders it inside its stack, or moves it into another stack.',
    'Gap and padding change only from their handle, so a click between stack items no longer resets the gap.',
    'Zoom to fit and zoom to selection go past 100% on small frames.'
  ]
} satisfies ChangelogEntry;
