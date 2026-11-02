import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Editor fixes',
  items: [
    'Hide and Lock are in the right-click menu of canvas nodes',
    'Hiding or locking several nodes is one undo step',
    'Resizing the main of a component set resizes only the main, and the set grows around it',
    'A pasted or duplicated image keeps its name',
    'The left toolbar no longer covers the timeline controls in Motion mode',
    'Grouped elements keep their exact size'
  ]
} satisfies ChangelogEntry;
