import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Download any image or video from its node, in the format you choose',
  items: [
    'Image and video nodes, Effects and Composition now have a download button with a format menu.',
    'Images: PNG, JPEG, WebP, AVIF where supported, or the original file untouched.',
    'Videos: MP4 or GIF, sized to keep the file reasonable.'
  ]
} satisfies ChangelogEntry;
