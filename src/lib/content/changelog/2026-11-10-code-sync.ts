import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-10',
  title: 'Edit imported code from the canvas',
  items: [
    'Text, colour, size and spacing you change on a frame imported from GitHub turn into a pull request on a new branch, or a patch you can download.',
    'Pull brings new commits into the frame and keeps your canvas edits; where both changed the same thing, the code wins and you see the conflict.',
    'In local mode, import a project folder: edits are written to its files and file changes show up on the canvas.'
  ]
} satisfies ChangelogEntry;
