import { describe, it, expect } from 'vitest';
import { spentUsd } from '$lib/server/motion/model-route';

const OPUS = { input: 4, cachedInput: 0.4, output: 20 };
const CREATE_TURN = { inputTokens: 403_924, outputTokens: 1_515 };
const MEASURED_UNCACHED_USD = 1.646;
const CACHE_HIT_SHARE_SEEN_ON_MOTION = 0.9;
const CREATE_TARGET_USD = 0.6;

const rate = () => OPUS;

describe('a canvas chat turn priced from the tokens recorded on 2026-10-14', () => {
  it('without the cache the create turn costs what production billed', () => {
    expect(spentUsd([CREATE_TURN], ['opus'], rate)).toBeCloseTo(MEASURED_UNCACHED_USD, 2);
  });

  it('with the hit share the motion agent gets, the create turn fits its target', () => {
    const cached = { ...CREATE_TURN, cachedTokens: Math.round(CREATE_TURN.inputTokens * CACHE_HIT_SHARE_SEEN_ON_MOTION) };

    expect(spentUsd([cached], ['opus'], rate)).toBeLessThan(CREATE_TARGET_USD);
  });
});
