import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'New canvas renderer on devices without WebGPU',
  items: ['The new canvas renderer now also runs where WebGPU is missing, such as older iPhones.', 'Shapes and frames no longer show the dot grid through them.', 'Cards whose picture cannot load keep their last preview.']
} satisfies ChangelogEntry;
