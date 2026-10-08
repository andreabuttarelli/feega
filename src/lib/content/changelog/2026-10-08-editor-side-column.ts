import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-08',
  title: 'One side column in the motion editor',
  items: [
    'Chat and Properties now share one wider column: switch with the tabs at its top.',
    'The agent keeps working while you look at Properties; a dot tells you it is still running.',
    'Drag the column edge to resize it, double-click to reset. Your width and tab are remembered.'
  ]
} satisfies ChangelogEntry;
