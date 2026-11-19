import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'One place for your connections',
  items: [
    'Settings has one Connections list: GitHub, Figma, Google Drive, Dropbox and OneDrive, each with Connect and Disconnect.',
    'Figma connects with a sign-in instead of a pasted token.',
    'OneDrive joins Google Drive and Dropbox for importing files and exporting images and videos.'
  ]
} satisfies ChangelogEntry;
