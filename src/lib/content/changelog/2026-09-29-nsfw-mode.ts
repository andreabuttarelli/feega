import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Separate area for age-restricted features',
  items: [
    'Some Wiro models are available only in projects with age-restricted features.',
    "Age-restricted features need a paid plan, the owner's opt-in and your own age verification.",
    'These projects are badged and cannot be shared, published, scheduled or promoted.',
    'Every generated result is labelled AI-generated, also in the downloaded file name.'
  ]
} satisfies ChangelogEntry;
