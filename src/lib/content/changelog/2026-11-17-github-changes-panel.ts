import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Changes panel for GitHub frames',
  items: ['Click a frame’s GitHub icon to see its file and commit, update it, open its pull request or unlink it.', 'The Changes panel turns the edited frames you tick into a pull request, shows its CI and can undo the last push.']
} satisfies ChangelogEntry;
