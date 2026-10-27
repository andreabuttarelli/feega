import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'Prototype links',
  items: [
    'Link any layer to another frame: press Link to frame in Properties and click the target on the canvas. Arrows show every link.',
    'Choose a trigger (click, hover, drag, after a delay), an action (navigate, open overlay, back, scroll to) and a transition (instant, dissolve, slide, push) with easing and duration.',
    'The agent can add, list and remove interactions.'
  ]
} satisfies ChangelogEntry;
