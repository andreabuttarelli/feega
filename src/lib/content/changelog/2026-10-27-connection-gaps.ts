import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-27',
  title: 'Better Figma, Drive and Dropbox connections',
  items: [
    'Disconnect Google Drive or Dropbox from the file picker or from Settings.',
    'Folders in Drive and Dropbox load page by page, and Google Docs, Sheets and Slides import as PDF.',
    'When Figma images cannot load, the canvas says why: token refused, too many requests, or Figma not answering.',
    'The Figma token test passes even without the Current user scope.',
    'Drive exports work at the top level, keep the original file name, and failures read in plain words.',
    'Drive and Dropbox files and the Figma token status are available from the CLI and to agents over MCP.'
  ]
} satisfies ChangelogEntry;
