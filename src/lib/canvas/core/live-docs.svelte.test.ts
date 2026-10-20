import { describe, expect, it } from 'vitest';
import { liveDocs, type LiveDoc } from './live-docs.svelte';

const live = (tag: string) => ({ doc: { tag }, tokens: {}, assets: {} }) as unknown as LiveDoc;

describe('live docs', () => {
  it('publishes the doc being edited under its node id, and replaces it on every edit', () => {
    liveDocs.set('a', live('one'));
    liveDocs.set('a', live('two'));

    expect((liveDocs.map.get('a')?.doc as unknown as { tag: string }).tag).toBe('two');
  });

  it('forgets a node when its editor closes', () => {
    liveDocs.set('b', live('x'));
    liveDocs.clear('b');

    expect(liveDocs.map.has('b')).toBe(false);
  });
});
