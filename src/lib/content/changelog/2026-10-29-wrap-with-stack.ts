import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Wrap with stack',
  items: [
    'Add auto layout is now Wrap with stack (⇧A): it works on text and shapes inside a frame and free on the canvas.',
    'Remove stack (⌥⇧A) unwraps a stack and keeps its children in place.',
    'Wrap with stack and Remove stack are in the right-click menu, the Layers menu, the selection toolbar and the right bar.',
    'Stacks can stretch their children across the cross axis.',
    'Layers has a right-click menu with rename, hide, lock, stack and component actions.',
    'Arranging tiles in a row is now called Stack tiles.'
  ]
} satisfies ChangelogEntry;
