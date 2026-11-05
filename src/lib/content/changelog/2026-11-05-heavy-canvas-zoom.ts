import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-05',
  title: 'Smoother zoom on heavy canvases',
  items: ['Zooming a canvas full of frames with shadows and blurs no longer freezes the page, and uses less graphics memory.']
} satisfies ChangelogEntry;
