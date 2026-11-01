import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Canvas fixes',
  items: [
    'Switching pages draws the page right away.',
    'The canvas recovers after the graphics card drops it, instead of staying blank.',
    'Folded rows in Layers stay folded after a reload.',
    'Wrap with stack takes component instances too.',
    'Typing a stack width keeps it in place.',
    'Width and height in Layout show the size a stack really has.'
  ]
} satisfies ChangelogEntry;
