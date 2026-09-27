import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Paste a single product link into the Products node',
  items: [
    'The Products node now understands a link to one product, not just a whole store.',
    'Paste a collection link and the category is set automatically.',
    'Paste several product links (one per line or comma-separated) to sync all of them.',
    'The node shows what it understood — "1 product", "collection: shoes", or "whole store".'
  ]
} satisfies ChangelogEntry;
