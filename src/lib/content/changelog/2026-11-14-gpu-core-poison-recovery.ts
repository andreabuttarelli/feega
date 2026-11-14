import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-14',
  title: 'Canvas recovers from a GPU crash',
  items: ['On slow or software graphics, a rendering crash no longer leaves the canvas broken: it restarts its renderer and keeps drawing.']
} satisfies ChangelogEntry;
