import { describe, expect, it } from 'vitest';
import { Resolution, renderQuote } from './render-quote';

describe('render quote', () => {
  it('15 seconds at 1080p cost two units of ten seconds, doubled', () => {
    expect(renderQuote({ width: 1080, height: 1920, durationInFrames: 450, fps: 30 })).toEqual({ seconds: 15, resolution: Resolution.P1080, credits: 4 });
  });

  it('720p costs one credit per started ten seconds', () => {
    expect(renderQuote({ width: 1280, height: 720, durationInFrames: 301, fps: 30 }).credits).toBe(2);
    expect(renderQuote({ width: 1280, height: 720, durationInFrames: 300, fps: 30 }).credits).toBe(1);
  });
});
