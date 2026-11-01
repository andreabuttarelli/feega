import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Resizing a design keeps its type size',
  items: [
    'Resizing a still frame keeps text, borders and laid-out blocks at their size instead of scaling them.',
    'An imported page fills the frame you resize it to, with centred content narrowing and paragraphs rewrapping.'
  ]
} satisfies ChangelogEntry;
