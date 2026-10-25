import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Canvas shows edits as you make them',
  items: ['Image adjustments and other Properties sliders update the canvas while you drag.', 'A video just combined from scenes no longer shows a black box while it loads.', 'Zooming a crop out stops at the full picture instead of stretching it.', 'Frames at rest show text that fades in, not an empty first frame.']
} satisfies ChangelogEntry;
