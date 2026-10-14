import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Agents can upload files and manage custom voices',
  items: [
    'Upload an image, video or document into a canvas from the CLI with `feega canvas upload`, or from any MCP agent.',
    'Custom voices (library, design, clone, delete) now work from the CLI and MCP agents too.',
    'The project chat can now run every canvas action: rename and share canvases, templates, workflows and voices.'
  ]
} satisfies ChangelogEntry;
