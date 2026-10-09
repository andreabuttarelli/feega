import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Version history for motion videos',
  items: [
    'Restore any saved version of a motion video from the History button; nothing is ever deleted.',
    'The motion agent puts back the last good version itself when an edit goes wrong.',
    'Restore versions from the CLI and MCP too.'
  ]
} satisfies ChangelogEntry;
