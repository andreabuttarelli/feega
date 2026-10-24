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

  it('counts edits of the doc, not playhead moves', () => {
    const first = live('one');
    liveDocs.set('c', first);
    liveDocs.set('c', { ...first, playhead: 5 });
    liveDocs.set('c', live('two'));

    expect(liveDocs.edits.get('c')).toBe(2);
    liveDocs.clear('c');
    expect(liveDocs.edits.has('c')).toBe(false);
  });
});
