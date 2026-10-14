import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Draw inside a frame',
  items: [
    'Text, rectangle, ellipse and pen tools in every frame: drag to draw, shift keeps the ratio.',
    'The pen draws curves: click for corners, drag for handles, click the first point to close.',
    'Double-click a text in a frame to edit it in place.'
  ]
} satisfies ChangelogEntry;
