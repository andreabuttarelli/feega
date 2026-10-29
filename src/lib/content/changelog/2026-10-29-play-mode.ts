import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Play mode',
  items: [
    'Play mode draws prototype links as arrows from each layer to its frame and hides the lines between nodes.',
    'Drag the handle of a selected layer onto a frame to link it; click an arrow to edit trigger, transition and duration.',
    'The Play panel holds the flow, Play, Copy play link, Play on canvas and Interactive.'
  ]
} satisfies ChangelogEntry;
