import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Groups and selection on the canvas',
  items: [
    'Clicking a group selects the group, and its properties show its position and size.',
    'Enter on a selected group selects what it holds.',
    'Esc on a free text or shape clears the selection.',
    'The properties panel opens on the first click after a reload.',
    'R draws a rectangle and ⇧R shows the rulers, as in Figma.',
    'Esc closes the layer rename field opened with ⌘R.'
  ]
} satisfies ChangelogEntry;
