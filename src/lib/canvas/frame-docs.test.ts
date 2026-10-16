import { describe, expect, it } from 'vitest';
import { frameDocs, posterCurrent } from './frame-docs.svelte';

const entry = (version: number, html = `<p>${version}</p>`) => ({ version, html, width: 100, height: 100, fps: 30, durationInFrames: 30 });

describe('frame docs', () => {
  it('the tile reads the editor local doc, newest edit first, never an older one', () => {
    frameDocs.put('a', entry(3, 'red'));
    frameDocs.put('a', entry(3, 'green'));
    frameDocs.put('a', entry(2, 'stale'));

    expect(frameDocs.latest('a', 3)?.html).toBe('green');
  });

  it('a server head newer than the local doc wins, so a peer edit is not hidden', () => {
    frameDocs.put('b', entry(4));

    expect(frameDocs.latest('b', 5)).toBeNull();
    expect(frameDocs.latest('b', 4)?.version).toBe(4);
  });

  it('a poster never stands in for a local doc, which can be newer than any upload', () => {
    frameDocs.put('c', entry(6));

    expect(posterCurrent(frameDocs.latest('c', 6))).toBe(false);
    expect(posterCurrent(frameDocs.latest('c', 7))).toBe(true);
  });

  it('a save that lands after the editor closed moves the local doc to the saved version', () => {
    frameDocs.put('d', entry(2, 'green'));
    frameDocs.landed('d', 2, 3);

    expect(frameDocs.latest('d', 3)?.html).toBe('green');
  });

  it('a save landing on a base the store already left changes nothing', () => {
    frameDocs.put('e', entry(5, 'newer'));
    frameDocs.landed('e', 2, 3);

    expect(frameDocs.latest('e', 5)?.html).toBe('newer');
  });

  it('the realtime echo of an own save arriving before its response keeps the local doc', () => {
    frameDocs.put('f', entry(2, 'green'));
    frameDocs.sending('f');

    expect(frameDocs.latest('f', 3)?.html).toBe('green');

    frameDocs.landed('f', 2, 3);
    expect(frameDocs.latest('f', 4)).toBeNull();
  });
});
