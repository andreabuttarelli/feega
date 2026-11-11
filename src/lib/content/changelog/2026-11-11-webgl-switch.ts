import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'The canvas survives a failing graphics card',
  items: ['When WebGPU keeps failing, the canvas switches to WebGL on the spot, keeping your work and your view.']
} satisfies ChangelogEntry;
