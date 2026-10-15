import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Select inside frames like in Figma',
  items: [
    'Hovering a frame on the canvas outlines the element under the pointer.',
    'Double-click goes one level deeper: frame, element, then its parts and text.',
    'Esc or Shift+Enter goes back up, Enter goes down, ⌘-click selects the innermost element.',
    'Layers scrolls to what you select on the canvas.'
  ]
} satisfies ChangelogEntry;
