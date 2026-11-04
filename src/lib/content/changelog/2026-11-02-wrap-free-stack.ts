import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Wrap with stack',
  items: [
    'Wrapping Stacks in a Stack keeps each one with its own children',
    'A new Stack keeps the spacing and direction the elements already had, and comes selected',
    'Undo and redo of a wrap bring the Stack back intact',
    'Dragging the side or corner of a Stack resizes it instead of stretching what is inside',
    'The Stack tool draws an empty Stack at the size you drag'
  ]
} satisfies ChangelogEntry;
