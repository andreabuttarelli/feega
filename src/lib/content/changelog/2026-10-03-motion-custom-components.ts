import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-03',
  title: 'Motion: components in code',
  items: [
    'The motion agent can write its own animated components in code when the library is not enough: product UI, chats, calendars, cursors.',
    'A Code tab shows and edits a component’s HTML, CSS and JS with a live preview, undo and a diff of the last change.',
    'Every component is checked to look the same whichever way you scrub; one that fails cannot be exported until it is fixed.',
    'Variables a component declares appear in Properties, grouped, so text, colours, fonts and pictures stay editable without touching code.',
    'Number and colour variables of a component can be keyframed on the timeline.'
  ]
} satisfies ChangelogEntry;
