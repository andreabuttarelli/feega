import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Faster server renders',
  items: [
    'Motion blur now renders on many machines at once instead of one',
    'Strokes, shadows, liquid shapes and track mattes render several times faster',
    'A render machine that stops responding is restarted on smaller pieces instead of hanging'
  ]
};

export default entry;
