import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Smoother panning on busy canvases',
  items: ['Panning a canvas full of large frames stays smooth: still frames are kept ready to draw and redrawn sharp when you zoom.']
} satisfies ChangelogEntry;
