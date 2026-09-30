import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-30',
  title: 'Audio node connections match the operation',
  items: [
    'The Audio node now shows only the connectors its chosen operation can use — text for text to speech, audio or video for voice changer, dubbing and voice isolation.',
    'Connecting a node the current operation cannot use is refused with a clear reason, on the canvas and through the assistant.',
    'Switching an audio node to a different operation asks for confirmation before dropping connections it can no longer use.'
  ]
} satisfies ChangelogEntry;
