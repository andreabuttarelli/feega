import { describe, expect, it } from 'vitest';
import type { VideoFrames } from '@feega/motion-core/motion/gpu-full/video-frames';
import { ProxyMode, playbackSrc, proxying } from './video-proxy';

const ASSET = '/p/p1/c/c1/assets/a1';

describe('playbackSrc', () => {
  it('asks for the proxy of a canvas asset', () => {
    expect(playbackSrc(ASSET, ProxyMode.Proxy)).toBe(`${ASSET}?proxy=1`);
  });

  it('keeps the query it already has', () => {
    expect(playbackSrc(`${ASSET}?grant=g`, ProxyMode.Proxy)).toBe(`${ASSET}?grant=g&proxy=1`);
  });

  it('leaves the original untouched when proxies are off', () => {
    expect(playbackSrc(ASSET, ProxyMode.Original)).toBe(ASSET);
  });

  it('leaves a source that is not a canvas asset untouched', () => {
    expect(playbackSrc('https://cdn.example/clip.mp4', ProxyMode.Proxy)).toBe('https://cdn.example/clip.mp4');
  });
});

describe('proxying', () => {
  it('reads every frame through the source the mode picks', async () => {
    const seen: string[] = [];
    const inner = {
      has: (s: string) => (seen.push(s), true),
      at: async (s: string) => (seen.push(s), null),
      cached: (s: string) => (seen.push(s), []),
      forget: (s: string) => seen.push(s)
    } as unknown as VideoFrames;
    let mode = ProxyMode.Proxy;
    const frames = proxying(inner, () => mode);

    frames.has(ASSET, 0);
    await frames.at(ASSET, 0, 960);
    mode = ProxyMode.Original;
    frames.cached(ASSET);
    frames.forget(ASSET);

    expect(seen).toEqual([`${ASSET}?proxy=1`, `${ASSET}?proxy=1`, ASSET, ASSET]);
  });
});
