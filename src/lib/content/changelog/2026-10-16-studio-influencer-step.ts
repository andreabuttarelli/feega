import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-16',
  title: 'Photo studio: pick an influencer, faster batches',
  items: [
    'Photo studio has a "Choose your influencer" step with a photo of each one, and a Skip button.',
    'Influencers you cannot use show why instead of disappearing.',
    'Batches make up to 8 photos at once, and each photo appears as soon as it is ready.',
    'A photo that fails is retried once automatically.'
  ]
} satisfies ChangelogEntry;
