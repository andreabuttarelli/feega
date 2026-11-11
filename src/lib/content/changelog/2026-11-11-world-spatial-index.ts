import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Large canvases draw as fast as small ones',
  items: ['Drawing a part of the canvas now only looks at the frames in view, so canvases with thousands of frames no longer slow down as they grow.']
} satisfies ChangelogEntry;
