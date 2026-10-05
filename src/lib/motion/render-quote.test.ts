import { describe, expect, it } from 'vitest';
import { Resolution, renderCostUsd, renderQuote } from './render-quote';
import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';

const MEASURED_30S_1080P_USD = 0.0073;
const LIGHT_DOC_MARGIN = 3;

describe('render quote', () => {
  it('a 30 s 1080p render is priced from what its sandboxes cost, with a margin over the measured bill', () => {
    const quote = renderQuote({ width: 1920, height: 1080, durationInFrames: 900, fps: 30 });

    expect(quote).toMatchObject({ seconds: 30, resolution: Resolution.P1080 });
    expect(quote.credits / CREDITS_PER_USD_SUBSCRIPTION_LIST).toBeGreaterThan(MEASURED_30S_1080P_USD * LIGHT_DOC_MARGIN);
  });

  it('the price is the cost turned into credits at the list rate, rounded up', () => {
    const doc = { width: 1920, height: 1080, durationInFrames: 900, fps: 30 as const };

    expect(renderQuote(doc).credits).toBe(Math.ceil(renderCostUsd(doc) * CREDITS_PER_USD_SUBSCRIPTION_LIST));
  });

  it('every render pays the sandboxes starting and waiting, even a short one', () => {
    const short = renderQuote({ width: 1080, height: 1920, durationInFrames: 30, fps: 30 }).credits;

    expect(short).toBeGreaterThan(0);
    expect(renderQuote({ width: 1080, height: 1920, durationInFrames: 60, fps: 30 }).credits).toBeLessThan(2 * short);
  });

  it('motion blur costs one render per sample', () => {
    const blur = { enabled: true, shutterAngle: 180, shutterPhase: -90, samples: 8 };
    const doc = { width: 1080, height: 1920, durationInFrames: 450, fps: 30 as const };

    const fixed = renderCostUsd({ ...doc, durationInFrames: 0 });

    expect(renderCostUsd({ ...doc, motionBlur: blur }) - fixed).toBeCloseTo(8 * (renderCostUsd(doc) - fixed));
    expect(renderQuote({ ...doc, motionBlur: { ...blur, enabled: false } }).credits).toBe(renderQuote(doc).credits);
  });

  it('a bigger output costs by its pixels', () => {
    const doc = { width: 1920, height: 1080, durationInFrames: 900, fps: 30 as const };
    const at = (r: Resolution) => renderCostUsd(doc, r);

    expect(at(Resolution.P720)).toBeLessThan(at(Resolution.P1080));
    expect(at(Resolution.P1440)).toBeLessThan(at(Resolution.P2160));
    expect(renderQuote(doc, Resolution.P2160).resolution).toBe(Resolution.P2160);
  });

  it('50 and 60 fps cost more, they render more frames', () => {
    expect(renderCostUsd({ width: 1920, height: 1080, durationInFrames: 1800, fps: 60 as const })).toBeGreaterThan(renderCostUsd({ width: 1920, height: 1080, durationInFrames: 900, fps: 30 as const }));
  });
});
