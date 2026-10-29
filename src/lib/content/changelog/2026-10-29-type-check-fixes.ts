import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Canvas fixes',
  items: [
    'Drawing a line or an arrow on the canvas works again.',
    'Turning a section item on or off for a connected node saves instead of failing.',
    'Custom effects stay on an effects node after a reload.',
    'The history panel keeps its sessions while it updates live.',
    'Smart animate links cross-fade in the prototype player.',
    'Compositions with a custom layout no longer break the compose page.',
    'The instance image picker lists images by name.',
    'The desktop canvas no longer stops on live selection overlays.'
  ]
} satisfies ChangelogEntry;
