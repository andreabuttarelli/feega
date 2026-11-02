import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Imported pages come with far more components',
  items: [
    'Import from URL now makes components of the parts a designer would: buttons, badges, nav and footer links, inputs, tabs, avatars, logos, cards, testimonials and pricing tiers, even when the page shows one only once.',
    'Parts that differ a little are variants of one set, with properties named for what changes: Style, Size, Icon, Image.',
    'A button inside a card is a Button instance inside the Card component, as in Figma.'
  ]
} satisfies ChangelogEntry;
