import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-11-27',
  title: 'Fewer false render warnings',
  items: ['Harmless page errors no longer flag a component that renders fine as failed.']
};

export default entry;
