import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Canvases live in your project folder',
  items: [
    'Open a project folder in the desktop app: the canvas is saved in .feega/, one file per node, ready for git.',
    'Changes pulled from git load on open; when both sides edited the same thing, pick Keep mine or Keep theirs.',
    'Every image, video, audio file and font is stored in the folder, downloaded once even when it came from a link.'
  ]
} satisfies ChangelogEntry;
