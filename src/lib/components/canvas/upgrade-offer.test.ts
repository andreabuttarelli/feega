import { describe, expect, it, vi } from 'vitest';
import { countdown, OfferReason } from '$lib/upgrade-offer';
import { upgradeOffer } from './upgrade-offer.svelte';

describe('upgrade offer', () => {
  it('counts down in minutes and seconds, never below zero', () => {
    expect(countdown(61_000, 0)).toBe('1:01');
    expect(countdown(0, 5_000)).toBe('0:00');
  });

  it('asks the server once and keeps the deadline it returns', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ state: 'live', expiresAt: 42 })));

    await upgradeOffer.show('p1', OfferReason.FirstResult, fetcher as unknown as typeof fetch);
    await upgradeOffer.show('p1', OfferReason.CreditsOut, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(upgradeOffer.expiresAt).toBe(42);
  });
});
