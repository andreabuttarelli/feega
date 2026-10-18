import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'A Layer section',
  items: [
    'Blend and opacity sit on one row; opacity has a number and a slider.',
    'Flip any layer horizontally or vertically.',
    'Rectangles get corner smoothing, and one radius until you split it per corner.',
    'A layer with children can clip them to its box.',
    'Yes / No switches replace checkboxes; auto layout sizes read Fixed, Fit and Fill, and padding is one value until you split it per side.'
  ]
} satisfies ChangelogEntry;
