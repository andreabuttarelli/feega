import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-21',
  title: 'A faster canvas by default',
  items: ['The canvas now opens on the new, faster renderer. Add ?renderer=gpu to the address to go back to the previous one.']
} satisfies ChangelogEntry;
