import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Server renders are paid by the time they take',
  items: [
    'Server renders charge the machine time they really use; the quote shown before rendering covers 3D, device mockups, motion blur and 4K',
    'A render holds its credits while it runs, gives back what it did not use, and costs nothing if it fails or you cancel it',
    'Agent chat answers cost more credits'
  ]
};

export default entry;
