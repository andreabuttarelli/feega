import { describe, expect, it } from 'vitest';
import { liveTiles, posterDue } from './live-tiles.svelte';
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

describe('posters from live tiles', () => {
  const due = { live: true, drawn: true, unsaved: false, atHead: true, hasPoster: false, shooting: false };

  it('a live tile drawn at the server revision with no poster for it shoots one', () => {
    expect(posterDue(due)).toBe(true);
  });

  it('never shoots an unsaved local doc, an older revision, twice, or a tile already covered', () => {
    expect(posterDue({ ...due, unsaved: true })).toBe(false);
    expect(posterDue({ ...due, atHead: false })).toBe(false);
    expect(posterDue({ ...due, shooting: true })).toBe(false);
    expect(posterDue({ ...due, hasPoster: true })).toBe(false);
    expect(posterDue({ ...due, drawn: false })).toBe(false);
  });
});
