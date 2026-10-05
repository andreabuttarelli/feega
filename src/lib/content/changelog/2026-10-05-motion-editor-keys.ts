import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-05',
  title: 'Motion editor: Play works, keyboard shortcuts, more room',
  items: [
    'Play in the motion editor starts the preview again.',
    'After Effects style shortcuts: Space, J/K/L, arrows, Home/End, I/O, [ ], ⌥[ ⌥], P/S/R/T/U, ⇧⌘D and more. Press ? for the list.',
    'Hide the agent (⌘B) and the properties (⌥⌘B) panels; the editor remembers your choice.',
    'The ◆ on a clip scrolls its keyframe rows into view, and the graph editor shows the selected clip curves.',
    'Drag the top edge of the timeline to make it taller or shorter.'
  ]
} satisfies ChangelogEntry;
