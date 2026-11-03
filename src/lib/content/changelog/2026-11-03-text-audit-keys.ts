import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Text and layer shortcuts',
  items: [
    'A text box you drag out starts at 16 px, left aligned, at the width you drew.',
    '⌘] and ⌘[ move a layer one step; ⌥⌘] and ⌥⌘[ send it to the front or back.',
    '⌘R renames the selected layer.',
    'Pasting while editing a text pastes only into the text.',
    'Esc leaves comment mode and closes the comments panel.',
    'Deleting the canvas you are on takes you to another one.'
  ]
} satisfies ChangelogEntry;
