import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Importing a page from a URL is faster',
  items: ['Heavy pages like stripe.com import in under a minute instead of about four.', 'A page that cannot be read in time now says so at once instead of trying again from scratch.']
} satisfies ChangelogEntry;
