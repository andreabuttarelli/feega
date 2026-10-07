import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'More export formats for motion videos',
  items: [
    'Server renders now export MP4 (H.264 or HEVC), ProRes 422 HQ, ProRes 4444 with alpha, transparent WebM, GIF and PNG sequences, with Social, Master, Web and GIF presets.',
    'A motion video can have a transparent background, so end cards and overlays keep their alpha.'
  ]
} satisfies ChangelogEntry;
