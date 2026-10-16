import { describe, expect, it } from 'vitest';
import { liveTiles } from './live-tiles.svelte';
import { Viewport } from '$lib/motion/editor-layout';

describe('live tiles', () => {
  it('grants players up to the cap, in the order tiles came into view', () => {
    const tiles = liveTiles(() => 2);
    tiles.want('a');
    tiles.want('b');
    tiles.want('c');

    expect(['a', 'b', 'c'].map(tiles.live)).toEqual([true, true, false]);
  });

  it('a tile leaving the view hands its player to the next one waiting', () => {
    const tiles = liveTiles(() => 2);
    tiles.want('a');
    tiles.want('b');
    tiles.want('c');
    tiles.drop('a');

    expect(['a', 'b', 'c'].map(tiles.live)).toEqual([false, true, true]);
  });

  it('wanting twice does not take two players', () => {
    const tiles = liveTiles(() => 2);
    tiles.want('a');
    tiles.want('a');
    tiles.want('b');

    expect(tiles.live('b')).toBe(true);
  });

  it('a phone keeps fewer players live than a desktop', async () => {
    const { LIVE_CAP } = await import('./live-tiles.svelte');

    expect(LIVE_CAP[Viewport.Phone]).toBeLessThan(LIVE_CAP[Viewport.Desktop]);
  });
});
