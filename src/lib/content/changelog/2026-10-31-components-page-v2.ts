import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-31',
  title: 'Cleaner component sets and stripe.com imports',
  items: [
    'Component sets stand free on the Components page, with space between variants.',
    'Switch an instance between variants from chips in the right bar.',
    'Instances show their Hover and Pressed variants in the prototype player.',
    'stripe.com and other heavy sites import again.',
    'Undoing a site import also removes its components.'
  ]
} satisfies ChangelogEntry;
