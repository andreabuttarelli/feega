import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Groups and shape tools inside frames',
  items: [
    '⌘G and ⇧⌘G group and ungroup the elements selected inside a frame; ⌥⌘G wraps them in a frame.',
    'Union, subtract, intersect, exclude, flatten, outline stroke and outline text are in the right-click menu and the properties bar.',
    '⌘-click selects the deepest element; ⌥⌘A selects matching layers, ⌘A the siblings.',
    'Keyboard shortcut labels are all in English.'
  ]
} satisfies ChangelogEntry;
