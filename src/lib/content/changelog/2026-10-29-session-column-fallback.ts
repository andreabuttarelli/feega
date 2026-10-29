import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Component drops save again',
  items: ['Dropping a component on the canvas or into a frame saves again instead of showing a save error.', 'Save errors on the canvas can be dismissed, clear themselves after a few seconds, and a change that keeps failing stops retrying and reloads.']
} satisfies ChangelogEntry;
