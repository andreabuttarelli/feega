import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Smoother pan and zoom on big canvases',
  items: ['Moving the view no longer redoes work for every frame on the canvas, so panning and zooming cost the same with ten frames or hundreds.']
} satisfies ChangelogEntry;
