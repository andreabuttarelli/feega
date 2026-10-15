import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Model list for agents and the CLI',
  items: [
    'The project chat and connected agents can list the models a project can use, with provider, price and whether they are age-restricted.',
    'New CLI command: feega canvas models <projectId>.',
    'The model menu marks prices that come from a cheaper route.'
  ]
} satisfies ChangelogEntry;
