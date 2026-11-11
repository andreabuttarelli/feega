import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Start from a prompt',
  items: [
    'The home is one prompt: pick motion video or website design, describe it, and a canvas opens with the agent already working.',
    'Paste a URL in the prompt and the site is imported first, so the agent works from the real page.',
    'Bring in a GitHub repo, a local folder or a Figma file from the prompt: it is imported first and the agent starts from it.',
    'Type a prompt before signing up; it sends itself once you are in.',
    'The free plan includes 20 agent messages.'
  ]
} satisfies ChangelogEntry;
