import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Groups that act like groups',
  items: [
    'A group made with ⌘G is called Group and shows only what a group has: position, size, appearance and effects.',
    'Changing X, Y, W or H of a group moves and scales everything inside it.',
    'Grouping inside a stack keeps the group in the stack; ungrouping puts the layers back where the group was.',
    '⌥⌘G wraps the selection in a Frame and selects it.',
    'Deleting a stack or a group deletes what it holds, inside a frame as on the canvas.'
  ]
} satisfies ChangelogEntry;
