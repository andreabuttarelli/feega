import { describe, expect, it } from 'vitest';
import { CHAT_MULTIPLIER, billedCreditsFor } from '$lib/credit-ladder';
import { DEEP_CAP_FACTOR, DEEP_ITERATIONS, creditsLeft, creditsOfUsd, deepQuote, roundUsd, shouldStop } from './budget';

const OPUS = { input: 5, cachedInput: 0.5, output: 25 };
const FLASH = { input: 0.075, cachedInput: 0.015, output: 0.25 };

describe('what a Deep job costs before it starts', () => {
  it('quotes in credits at the agent multiplier, plus the frame renders', () => {
    const quote = deepQuote(OPUS);

    expect(quote.credits).toBe(billedCreditsFor(quote.llmUsd, CHAT_MULTIPLIER) + quote.renderCredits);
    expect(quote.iterations).toBe(DEEP_ITERATIONS.quoted);
    expect(quote.renderCredits).toBeGreaterThan(0);
  });

  it('prices an expensive model higher than a cheap one', () => {
    expect(deepQuote(OPUS).credits).toBeGreaterThan(deepQuote(FLASH).credits * 10);
  });

  it('caps the job above the quote, never below it', () => {
    const quote = deepQuote(OPUS);

    expect(quote.capUsd).toBeCloseTo(quote.usd * DEEP_CAP_FACTOR, 6);
    expect(quote.capCredits).toBeGreaterThan(quote.credits);
  });

  it('prices a model the gateway does not list at the most expensive known rate', () => {
    expect(deepQuote(null).credits).toBeGreaterThanOrEqual(deepQuote(OPUS).credits);
  });

  it('knows what one more build, render and critique round costs', () => {
    const quote = deepQuote(OPUS);

    expect(roundUsd(OPUS)).toBeGreaterThan(0);
    expect(roundUsd(OPUS)).toBeLessThan(quote.usd);
  });

  it('turns dollars spent into the credits the user sees', () => {
    expect(creditsOfUsd(1)).toBe(billedCreditsFor(1, CHAT_MULTIPLIER));
  });
});

describe('the credit cap is never passed', () => {
  it('quotes the credits the user will be charged, multiplier included', () => {
    const quote = deepQuote(OPUS);

    expect(quote.credits).toBeGreaterThanOrEqual(creditsOfUsd(quote.llmUsd));
    expect(creditsOfUsd(quote.capUsd)).toBeLessThanOrEqual(quote.capCredits);
  });

  it('caps every billed call at what is left of the cap', () => {
    expect(creditsLeft(3000, 2900)).toBe(100);
    expect(creditsLeft(3000, 3200)).toBe(0);
  });

  it('stops a round before the next step could pass the cap, not after', () => {
    expect(shouldStop({ spentUsd: 6, capUsd: 7.5, stepUsd: 1.6 })).toBe(true);
    expect(shouldStop({ spentUsd: 5, capUsd: 7.5, stepUsd: 1 })).toBe(false);
  });
});
