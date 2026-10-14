import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Inner shadow, background blur and tidier effects',
  items: [
    'New effects: inner shadow and background blur, which frosts what sits behind a layer.',
    'Every effect has an eye to hide it without removing it.',
    'Effect, stroke and fill settings open in a popover beside Properties; rows stay short.',
    'Shadow and glow colours carry their opacity in the colour field.',
    'The add-effect menu scrolls instead of running off the screen.'
  ]
} satisfies ChangelogEntry;
