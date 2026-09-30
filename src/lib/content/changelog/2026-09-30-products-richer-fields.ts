import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-30',
  title: 'Richer product data',
  items: [
    'Product sync now captures sale prices, tags, vendor, product type, SKU, variants and options.',
    'Products on sale show a −N% badge on the canvas and in shared views.',
    'Filter a catalog by tag, vendor, product type, or on-sale items only.',
    'A Select on a catalog can output discount %, compare-at price, tags, vendor, SKU, variants and options.'
  ]
} satisfies ChangelogEntry;
