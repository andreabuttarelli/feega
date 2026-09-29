import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Separate NSFW workspace',
  items: [
    'Wiro models are available only inside NSFW projects, created from the NSFW workspace.',
    'The NSFW workspace needs a paid plan, the owner\'s opt-in and your own age verification. Age verification is coming soon.',
    'NSFW projects are badged, listed apart, and cannot be shared, published, scheduled or promoted.',
    'Every generated result is labelled AI-generated, also in the downloaded file name.'
  ]
} satisfies ChangelogEntry;
