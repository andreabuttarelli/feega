import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Age-restricted models no longer accept references',
  items: [
    'Age-restricted models now show no connection points on the canvas, and the References picker is hidden with a short note.',
    'Switching a node to an age-restricted model now asks for confirmation before removing its existing connections and references.',
    'Dragging a connection into an age-restricted model node is refused, with a clear reason.'
  ]
} satisfies ChangelogEntry;
