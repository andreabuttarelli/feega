import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'VS Code opens your folder as a Feega project',
  items: [
    'Feega: Open this folder as a project keeps the canvas in .feega/, committed with your repo.',
    'In a git repo the top bar shows the branch, commits the canvas, pushes and opens a pull request.',
    'Set feega.devServerPath to run a local clone of Feega instead of the latest release.'
  ]
} satisfies ChangelogEntry;
