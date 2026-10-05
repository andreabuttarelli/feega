import { describe, expect, it } from 'vitest';
import { drawOnce, screenKey } from './three-draw';

describe('drawOnce', () => {
  it('a seek repeated at the same time draws once: the producer seeks a frame several times', () => {
    const drawn: number[] = [];
    const draw = drawOnce((t) => drawn.push(t));

    draw.at(0.5);
    draw.at(0.5);
    draw.at(0.5);
    draw.at(0.6);

    expect(drawn).toEqual([0.5, 0.6]);
  });

  it('a video frame injected after the seek draws the same time again: the producer reseeks once it lands', () => {
    const drawn: number[] = [];
    let frame = 'f1';
    const draw = drawOnce((t) => drawn.push(t), () => frame);

    draw.at(0.5);
    frame = 'f2';
    draw.at(0.5);

    expect(drawn).toEqual([0.5, 0.5]);
  });

  it('a texture that lands late forces the same time to draw again', () => {
    const drawn: number[] = [];
    const draw = drawOnce((t) => drawn.push(t));

    draw.at(0.5);
    draw.again();

    expect(drawn).toEqual([0.5, 0.5]);
  });
});

describe('screenKey', () => {
  it('a still screenshot at the same scroll is the same screen, so its texture is not uploaded again', () => {
    const img = { src: 'https://x/a.jpg', naturalWidth: 10 };

    expect(screenKey(img, 0.2)).toBe(screenKey(img, 0.2));
    expect(screenKey(img, 0.3)).not.toBe(screenKey(img, 0.2));
  });

  it('a video frame is a new screen whenever the frame image or the video time moves', () => {
    expect(screenKey({ src: 'blob:f1', naturalWidth: 10 }, 0)).not.toBe(screenKey({ src: 'blob:f2', naturalWidth: 10 }, 0));
    expect(screenKey({ currentSrc: 'v.mp4', currentTime: 1, videoWidth: 10 }, 0)).not.toBe(screenKey({ currentSrc: 'v.mp4', currentTime: 1.04, videoWidth: 10 }, 0));
  });

  it('no source yet is its own key, so the first real frame always draws', () => {
    expect(screenKey(null, 0)).not.toBe(screenKey({ src: 'a', naturalWidth: 1 }, 0));
  });
});
