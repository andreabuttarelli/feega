import { describe, expect, it } from 'vitest';
import { Resolution, renderQuote } from './render-quote';

describe('render quote', () => {
  it('15 seconds at 1080p cost two units of ten seconds, doubled', () => {
    expect(renderQuote({ width: 1080, height: 1920, durationInFrames: 450, fps: 30 })).toEqual({ seconds: 15, resolution: Resolution.P1080, credits: 4 });
  });

  it('motion blur costs one render per sample', () => {
    const blur = { enabled: true, shutterAngle: 180, shutterPhase: -90, samples: 8 };

    expect(renderQuote({ width: 1080, height: 1920, durationInFrames: 450, fps: 30, motionBlur: blur }).credits).toBe(32);
    expect(renderQuote({ width: 1080, height: 1920, durationInFrames: 450, fps: 30, motionBlur: { ...blur, enabled: false } }).credits).toBe(4);
  });

  it('a bigger output costs by its pixels: 1440p twice 1080p, 4K four times', () => {
    const doc = { width: 1920, height: 1080, durationInFrames: 450, fps: 30 as const };

    expect(renderQuote(doc, Resolution.P1440).credits).toBe(8);
    expect(renderQuote(doc, Resolution.P2160)).toMatchObject({ resolution: Resolution.P2160, credits: 16 });
  });

  it('50 and 60 fps cost twice, they render twice the frames', () => {
    expect(renderQuote({ width: 1920, height: 1080, durationInFrames: 900, fps: 60 as const }).credits).toBe(8);
  });

  it('720p costs one credit per started ten seconds', () => {
    expect(renderQuote({ width: 1280, height: 720, durationInFrames: 301, fps: 30 }).credits).toBe(2);
    expect(renderQuote({ width: 1280, height: 720, durationInFrames: 300, fps: 30 }).credits).toBe(1);
  });
});
