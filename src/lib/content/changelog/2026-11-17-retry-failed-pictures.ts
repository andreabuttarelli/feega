import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Images that fail to load are retried',
  items: ['An image that fails to load on the canvas is tried again a few times once you stop moving.']
} satisfies ChangelogEntry;
