import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-11',
  title: 'Shader effects in motion videos',
  items: [
    'Add GPU shader effects to a video: gradients, noise, glass, metal, light, distortions, wipes and blurs.',
    'Every effect setting can be animated with keyframes, and the export matches the preview.',
    'Cursor effects react to the pointer in interactive embeds.'
  ]
} satisfies ChangelogEntry;
