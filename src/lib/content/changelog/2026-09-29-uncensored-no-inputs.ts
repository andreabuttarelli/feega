import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Uncensored models no longer accept references',
  items: [
    "Uncensored models now show no connection points on the canvas, and the References picker is hidden with a short note.",
    'Switching a node to an uncensored model now asks for confirmation before removing its existing connections and references.',
    'Dragging a connection into an uncensored-model node is refused, with a clear reason.'
  ]
} satisfies ChangelogEntry;
