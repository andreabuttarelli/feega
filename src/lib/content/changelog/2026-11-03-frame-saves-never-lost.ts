import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Edits are never lost',
  items: [
    'Frames hold hundreds of layers, and deleting layers no longer fills the frame up',
    'A save that fails tells you why and keeps your edit on this device until it lands',
    'Saves that drop on a bad connection are sent again on their own',
    'PNG export keeps every text layer',
    'Frames take tall pages, up to 16384 px a side; video size limits apply only when you export'
  ]
} satisfies ChangelogEntry;
