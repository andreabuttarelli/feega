import { describe, expect, it } from 'vitest';
import { OFFER_WINDOW_MS, OfferState, offerCode, personalOffer, type OfferStore, type PromoCode } from './offer';

function memoryStore(): OfferStore & { codes: Map<string, PromoCode> } {
  const codes = new Map<string, PromoCode>();
  return {
    codes,
    find: async (code) => codes.get(code) ?? null,
    create: async ({ code, expiresAt }) => {
      const promo = { id: `promo_${codes.size}`, code, expiresAt, redeemed: false, redemptionTracked: false };
      codes.set(code, promo);
      return promo;
    },
    markTracked: async (id) => {
      for (const promo of codes.values()) {
        if (promo.id === id) {
          promo.redemptionTracked = true;
        }
      }
    }
  };
}

const USER = '3f1c2b7a-9d4e-4c1a-8b2e-1234567890ab';

describe('personalOffer', () => {
  it('creates one code per user that expires an hour later', async () => {
    const store = memoryStore();
    const offer = await personalOffer(USER, store, 1_000);

    expect(offer).toMatchObject({ state: OfferState.Live, created: true, expiresAt: 1_000 + OFFER_WINDOW_MS });
    expect(store.codes.size).toBe(1);
  });

  it('the countdown never resets: a later call returns the same deadline', async () => {
    const store = memoryStore();
    await personalOffer(USER, store, 1_000);
    const again = await personalOffer(USER, store, 1_000 + 30 * 60 * 1000);

    expect(again).toMatchObject({ created: false, expiresAt: 1_000 + OFFER_WINDOW_MS });
    expect(store.codes.size).toBe(1);
  });

  it('after the hour the offer is expired, never recreated', async () => {
    const store = memoryStore();
    await personalOffer(USER, store, 1_000);
    const late = await personalOffer(USER, store, 1_000 + OFFER_WINDOW_MS + 1);

    expect(late.state).toBe(OfferState.Expired);
    expect(store.codes.size).toBe(1);
  });

  it('a redeemed code reports redeemed once', async () => {
    const store = memoryStore();
    await personalOffer(USER, store, 1_000);
    store.codes.get(offerCode(USER))!.redeemed = true;

    const first = await personalOffer(USER, store, 2_000);
    const second = await personalOffer(USER, store, 3_000);

    expect(first).toMatchObject({ state: OfferState.Redeemed, newlyRedeemed: true });
    expect(second).toMatchObject({ state: OfferState.Redeemed, newlyRedeemed: false });
  });

  it('codes differ per user', () => {
    expect(offerCode(USER)).not.toBe(offerCode('00000000-0000-0000-0000-000000000000'));
  });
});
