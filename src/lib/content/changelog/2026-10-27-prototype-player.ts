import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'Prototype player',
  items: [
    'Press Play on a frame to click through your prototype full screen, with the transitions you set.',
    'Mark a frame as a starting point to name a flow, and switch between flows in the player.',
    'Copy a play link: anyone can open it and click through the prototype without signing in.',
    'The agent can set a flow and get the play link.'
  ]
} satisfies ChangelogEntry;
