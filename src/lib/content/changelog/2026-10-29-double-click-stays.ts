import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Safer double-click in frames',
  items: ['Double-clicking elements in a frame or its Tablet and Phone views no longer moves them out of the frame.', 'Double-click steps into groups and component instances in Tablet and Phone views too.', 'Undo after dragging an element out of a frame restores it in one step.']
} satisfies ChangelogEntry;
