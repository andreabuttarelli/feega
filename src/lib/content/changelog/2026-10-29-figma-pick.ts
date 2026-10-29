import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Selecting inside frames',
  items: ['The hover outline inside a frame now shows exactly what a click selects; double-click goes one level deeper, Cmd/Ctrl-click straight to the deepest element, Esc back up.']
} satisfies ChangelogEntry;
