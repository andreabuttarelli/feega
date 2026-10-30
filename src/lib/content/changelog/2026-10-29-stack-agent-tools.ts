import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Stacks for agents and code export',
  items: [
    'Agents wrap, edit and remove stacks with wrap_in_stack, set_stack and remove_stack; the auto layout names keep working for one release.',
    'Agents can wrap free elements on the canvas in a stack.',
    'Stacks that stretch their children export with the right flex alignment in React, HTML and Svelte.'
  ]
} satisfies ChangelogEntry;
