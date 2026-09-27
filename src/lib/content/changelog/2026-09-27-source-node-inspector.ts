import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Filter your products and social feeds',
  items: [
    'Selecting a Products or Social feed node opens a settings panel on the right, with sync status and a Sync now button.',
    'Social feeds filter by date, media type (image, video, carousel), minimum likes or views and caption keywords, and sort by newest, most liked or most viewed.',
    'Products filter by text, price range and availability, sort by price or title, and can sync a single collection or category.',
    'Paste a profile URL or a store address without https — both are understood.',
    'Filters also apply to what Select and loops pick from the node.',
    'On the canvas, both nodes now show a grid of results with video and carousel markers.'
  ]
} satisfies ChangelogEntry;
