import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Pages show their images even when one fails',
  items: ['A page with one image that cannot load no longer shows every image as a grey block; only the missing one stays empty.']
} satisfies ChangelogEntry;
