import { describe, expect, it } from 'vitest';
import { OPENROUTER_UPSCALE_MODEL, upscaleLimitsOf, videoRefCapacity } from '$lib/video-models';
import { planUpscale, quoteUpscale, UpscaleMode, UpscaleTarget, upscaleParams } from './upscale';

const LIMITS = upscaleLimitsOf(OPENROUTER_UPSCALE_MODEL)!;
const PRICING = { cents_per_megapixel_second_precise: '7.5', cents_per_megapixel_second_creative: '10.5' };
const SD = { width: 854, height: 480, seconds: 2, bytes: 200_000, mimeType: 'video/mp4' };

describe('the upscale model declares what the provider documents', () => {
  it('takes one source clip of at most 20 s, 50 MB, mp4', () => {
    expect(videoRefCapacity(OPENROUTER_UPSCALE_MODEL).videos).toBe(1);
    expect(LIMITS.maxInputSeconds).toBe(20);
    expect(LIMITS.maxInputBytes).toBe(50 * 1024 * 1024);
    expect(LIMITS.inputMimeTypes).toEqual(['video/mp4']);
  });

  it('a generation model is not an upscaler', () => {
    expect(upscaleLimitsOf('bytedance/seedance-2-fast')).toBeNull();
  });
});

describe('planUpscale', () => {
  it('2× doubles both sides', () => {
    expect(planUpscale(SD, UpscaleTarget.Double, LIMITS)).toEqual({ ok: true, factor: 2, width: 1708, height: 960 });
  });

  it('4K aims the long edge at 3840, within the 3× ceiling', () => {
    const plan = planUpscale({ ...SD, width: 1920, height: 1080 }, UpscaleTarget.FourK, LIMITS);
    expect(plan).toEqual({ ok: true, factor: 2, width: 3840, height: 2160 });
  });

  it('4K from 480p stops at 3×, the most the model does', () => {
    expect(planUpscale(SD, UpscaleTarget.FourK, LIMITS)).toMatchObject({ ok: true, factor: 3, width: 2562, height: 1440 });
  });

  it('4K from 1440p takes the 1.5× floor', () => {
    expect(planUpscale({ ...SD, width: 2560, height: 1440 }, UpscaleTarget.FourK, LIMITS)).toEqual({ ok: true, factor: 1.5, width: 3840, height: 2160 });
  });

  it('the output never exceeds the provider frame cap', () => {
    const plan = planUpscale({ ...SD, width: 2560, height: 1440 }, UpscaleTarget.Double, LIMITS);
    expect(plan.ok && plan.width * plan.height).toBeLessThanOrEqual(14.4e6);
  });

  it.each([
    [{ seconds: 21 }, 'too_long'],
    [{ bytes: 51 * 1024 * 1024 }, 'too_large'],
    [{ width: 3840, height: 2160 }, 'resolution_too_high'],
    [{ mimeType: 'video/quicktime' }, 'format_not_supported'],
    [{ seconds: 0 }, 'unreadable_video']
  ])('refuses %o as %s', (change, error) => {
    expect(planUpscale({ ...SD, ...change }, UpscaleTarget.Double, LIMITS)).toEqual({ ok: false, error });
  });
});

describe('quoteUpscale', () => {
  it('prices output megapixels × seconds at the catalogue rate of the mode', () => {
    const plan = planUpscale(SD, UpscaleTarget.Double, LIMITS);
    if (!plan.ok) throw new Error('plan');
    const quote = quoteUpscale(plan, SD.seconds, PRICING, UpscaleMode.Precise);
    expect(quote.usd).toBeCloseTo(1.63968 * 2 * 0.075, 5);
    expect(quote.credits).toBe(Math.round((quote.usd ?? 0) * 200));
  });

  it('creative costs more than precise', () => {
    const plan = planUpscale(SD, UpscaleTarget.Double, LIMITS);
    if (!plan.ok) throw new Error('plan');
    expect(quoteUpscale(plan, 2, PRICING, UpscaleMode.Creative).usd).toBeGreaterThan(quoteUpscale(plan, 2, PRICING, UpscaleMode.Precise).usd ?? Infinity);
  });

  it('a catalogue without the rate says unknown, never zero', () => {
    const plan = planUpscale(SD, UpscaleTarget.Double, LIMITS);
    if (!plan.ok) throw new Error('plan');
    expect(quoteUpscale(plan, 2, {}, UpscaleMode.Precise)).toEqual({ usd: null, credits: null });
  });
});

describe('upscaleParams', () => {
  it('names the fields the provider reads', () => {
    expect(upscaleParams(2, UpscaleMode.Precise)).toEqual({ upscale_factor: 2, creativity: 0 });
    expect(upscaleParams(3, UpscaleMode.Creative)).toEqual({ upscale_factor: 3, creativity: 1 });
  });
});
