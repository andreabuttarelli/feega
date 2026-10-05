import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-05',
  title: 'Precomps and adjustment layers',
  items: [
    'Precompose clips (⇧⌘C) into a nested composition that plays as one clip, with its own trim and loop.',
    'Double-click a precomp to edit inside it; the breadcrumb takes you back.',
    'Adjustment layers apply their effects and blend mode to everything below them.',
    'The motion agent can precompose, edit inside compositions and add adjustment layers.'
  ]
} satisfies ChangelogEntry;
