import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Cleaner dragging and resize cursors',
  items: ['The hover outline no longer stays behind where an element was before you dragged it.', 'Edges, corners and rotate zones of a selection show resize and rotate cursors, turned with the element, and the whole edge can be grabbed.']
} satisfies ChangelogEntry;
