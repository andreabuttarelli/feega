import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-21',
  title: 'Frames stay steady on select',
  items: ['Selecting or deselecting a frame no longer makes it flash black and redraw.', 'Hovering an element inside a frame highlights that element, not the whole frame, and clicking it selects it directly.']
} satisfies ChangelogEntry;
