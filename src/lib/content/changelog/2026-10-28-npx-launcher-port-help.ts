import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'npx feega picks a free port',
  items: [
    'npx feega now picks a free port instead of clashing with a running dev server.',
    'npx feega --help and --version added; unknown options are rejected.'
  ]
} satisfies ChangelogEntry;
