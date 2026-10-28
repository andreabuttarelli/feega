// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CONTROLS_STRIP_PX, ownsPress } from './press-owner';

function videoAt(top: number, height: number): HTMLElement {
  const video = document.createElement('video');
  video.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) });
  return video;
}

describe('which element owns a press inside a node card', () => {
  it('a press on the playing area of a video moves the node', () => {
    expect(ownsPress(videoAt(0, 200), 50)).toBe(false);
  });

  it('a press on the controls strip of a video stays with the video', () => {
    expect(ownsPress(videoAt(0, 200), 200 - CONTROLS_STRIP_PX / 2)).toBe(true);
  });

  it('buttons and inputs keep their press', () => {
    expect(ownsPress(document.createElement('button'), 0)).toBe(true);
    expect(ownsPress(document.createElement('input'), 0)).toBe(true);
  });

  it('a plain div does not', () => {
    expect(ownsPress(document.createElement('div'), 0)).toBe(false);
  });
});
