import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Range selection and parent alignment',
  items: [
    'Shift-click in Layers selects a range of rows; Cmd-click adds or removes one.',
    'One element inside a frame aligns to its frame or container; in a stack it sets align-self.',
    'Align shortcuts and the right-click menu work on elements inside frames.'
  ]
} satisfies ChangelogEntry;
