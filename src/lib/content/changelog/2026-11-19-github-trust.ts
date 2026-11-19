import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Safer GitHub sync',
  items: [
    'Feega only writes to the branch you pick and never force-pushes or deletes branches',
    'Commits name you as author with Feega as co-author and a link to the canvas',
    'Open any commit to see its diff, and revert it with a new commit',
    'See everything Feega changed on a branch before opening a pull request',
    'Stop autosave from the top bar'
  ]
} satisfies ChangelogEntry;
