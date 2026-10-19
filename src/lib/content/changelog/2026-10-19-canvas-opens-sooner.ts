import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Canvases open sooner',
  items: ['A canvas starts loading up to 0.8 s sooner, because the server prepares less before sending it.']
} satisfies ChangelogEntry;
