import { describe, expect, it } from 'vitest';
import { TierBoard } from './tier-board.svelte';
import { Playback, videoMounted, View } from './live-video';

const shown = { view: View.Readable, onScreen: true, selected: false, playback: Playback.Paused };

describe('videoMounted', () => {
  it('mounts a video node seen on screen at a readable zoom', () => {
    expect(videoMounted(shown)).toBe(true);
  });

  it('unmounts it zoomed out and off screen', () => {
    expect(videoMounted({ ...shown, view: View.Overview })).toBe(false);
    expect(videoMounted({ ...shown, onScreen: false })).toBe(false);
  });

  it('keeps a selected or playing video mounted wherever it is', () => {
    const away = { ...shown, view: View.Overview, onScreen: false };

    expect(videoMounted({ ...away, selected: true })).toBe(true);
    expect(videoMounted({ ...away, playback: Playback.Playing })).toBe(true);
  });
});

describe('TierBoard on-screen nodes', () => {
  it('reports which nodes the last plan saw and whether the view was zoomed out', () => {
    const board = new TierBoard();

    board.see(new Set(['a']), View.Overview);

    expect(board.onScreen('a')).toBe(true);
    expect(board.onScreen('b')).toBe(false);
    expect(board.view).toBe(View.Overview);
  });
});
