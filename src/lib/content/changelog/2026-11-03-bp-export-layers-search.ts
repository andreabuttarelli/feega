import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Breakpoint export and Layers search',
  items: [
    'Right-click a breakpoint view and export it as an image at its width',
    'Layers search now looks only inside the current frame',
    'Enter on a layer selects its children; rename with double-click or Cmd+R'
  ]
} satisfies ChangelogEntry;
