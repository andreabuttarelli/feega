import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Stroke miter limit',
  items: ['Mitred strokes have a miter limit: raise it to keep sharp corners pointed, lower it to bevel them.']
} satisfies ChangelogEntry;
