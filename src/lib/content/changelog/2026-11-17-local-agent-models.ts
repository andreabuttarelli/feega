import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Pick the model of your local agent',
  items: [
    'In local Feega, a model menu next to the agent lists the models that agent really offers, and the choice is saved in the .feega file.',
    'New `feega agents models <agent>` lists and sets the model from the terminal.'
  ]
} satisfies ChangelogEntry;
