import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Frame selection',
  items: ['Cmd+Alt+G wraps the selected elements in a frame.', 'Shift+A on an auto layout removes it and keeps the elements where they are.', 'Bring forward, send backward, to front and to back now move a multi-selection as one block.']
} satisfies ChangelogEntry;
