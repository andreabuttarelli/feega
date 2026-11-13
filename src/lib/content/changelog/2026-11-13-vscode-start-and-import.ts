import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-13',
  title: 'VS Code extension: real progress and a working folder import',
  items: [
    'The VS Code canvas shows each start-up step under the Feega logo, in your editor theme.',
    'If Feega fails to start, the panel shows why, the last log lines and a Retry button.',
    '"Import this folder into a canvas" now imports the open folder.'
  ]
} satisfies ChangelogEntry;
