import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-07',
  title: 'Sturdier code components',
  items: [
    'Code components name their own variables freely, without clashing with built-in names',
    'Code components format numbers the same in preview and render (1,234 · 12.4K · 46%)',
    'A render with a video on a private address stops at once and says to import it as an asset'
  ]
};

export default entry;
