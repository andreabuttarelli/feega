import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'A real colour picker',
  items: [
    'Every colour now opens a full picker with a saturation square, hue and opacity sliders, and an eyedropper.',
    'Switch values between Hex, RGB, HSL and HSB, and reuse colours already in your design or brand.',
    'Gradient stops use the same picker, and one drag is one undo step.'
  ]
} satisfies ChangelogEntry;
